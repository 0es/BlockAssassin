import { BotConfig } from "@/config.ts";
import { logger } from "@/utils/logger.ts";
import gameService, { GameSentMessage } from "@/game/index.ts";

/**
 * Agent worker status
 */
export enum WorkerStatus {
    IDLE = "idle",
    RUNNING = "running",
    ERROR = "error",
    TERMINATED = "terminated",
}

/**
 * Worker message types
 */
export enum WorkerMessageType {
    INIT = "init",
    START = "start",
    STOP = "stop",
    ERROR = "error",
    LOG = "log",
    START_FAILED = "start_failed",

    // send to agent
    TASK = "task",
    RESULT = "result",

    // receive from agent
    SEND = "send",
}

/**
 * Worker message interface
 */
export type WorkerMessage =
    | { type: WorkerMessageType.SEND; data: GameSentMessage }
    | { type: Exclude<WorkerMessageType, WorkerMessageType.SEND>; data?: unknown };

/**
 * Manages multiple agent workers
 */
export class WorkerManager {
    private workers: Map<string, Worker>;
    private status: Map<string, WorkerStatus>;
    private workerModulePath: string;
    private errorCounts: Map<string, number>;
    private maxRetries: number = 3;
    private restartTimeout: number = 5000; // 5 seconds

    // Singleton instance
    private static instance: WorkerManager;

    /**
     * Get the WorkerManager instance
     * @param workerModulePath Optional path to the worker module
     * @returns WorkerManager instance
     */
    public static getInstance(workerModulePath?: string): WorkerManager {
        if (!WorkerManager.instance) {
            WorkerManager.instance = new WorkerManager(workerModulePath);
        }
        return WorkerManager.instance;
    }

    /**
     * Create a new WorkerManager
     * @param workerModulePath Path to the worker module
     */
    private constructor(workerModulePath: string = new URL("./thread.ts", import.meta.url).href) {
        this.workers = new Map();
        this.status = new Map();
        this.errorCounts = new Map();
        this.workerModulePath = workerModulePath;
    }

    /**
     * Initialize workers based on configurations
     * @param configs Array of bot configurations
     */
    public initWorkers(configs: BotConfig[]): void {
        // Terminate any existing workers
        this.terminateAllWorkers();

        // Initialize workers with provided configs
        for (const config of configs) {
            this.initWorker(config);
        }
    }

    /**
     * Initialize a single worker with provided configuration
     * @param config Bot configuration
     * @returns Success status
     */
    public initWorker(config: BotConfig): boolean {
        if (!config.name) {
            logger.error("Worker initialization failed: config missing name");
            return false;
        }

        // Terminate existing worker with same name if exists
        if (this.workers.has(config.name)) {
            this.terminateWorker(config.name);
        }

        // Reset error count for this worker
        this.errorCounts.set(config.name, 0);

        this.createWorker(config.name, config);
        return true;
    }

    /**
     * Create a new worker for a bot
     * @param name Worker name
     * @param config Bot configuration
     */
    private createWorker(name: string, config: BotConfig): void {
        try {
            // Create a new worker
            const worker = new Worker(this.workerModulePath, {
                type: "module",
                deno: {
                    permissions: {
                        net: true,
                        read: true,
                        env: true,
                        sys: true,
                    },
                },
            });

            // Setup message handling
            worker.addEventListener("message", (event) => {
                this.handleWorkerMessage(name, event.data as WorkerMessage);
            });

            worker.addEventListener("error", (error) => {
                this.handleWorkerError(name, error);
            });

            // Store the worker
            this.workers.set(name, worker);
            this.status.set(name, WorkerStatus.IDLE);

            // Initialize the worker with configuration
            worker.postMessage({
                type: WorkerMessageType.INIT,
                data: config,
            });

            logger.info(`Worker ${name} created`);
        } catch (error) {
            logger.error(`Failed to create worker ${name}: ${error}`);
            this.status.set(name, WorkerStatus.ERROR);
            // Don't attempt to restart here as the worker creation itself failed
        }
    }

    /**
     * Handle worker errors
     * @param name Worker name
     * @param error Error event
     */
    private handleWorkerError(name: string, error: ErrorEvent | string): void {
        const errorMessage = error instanceof ErrorEvent ? error.message || "Unknown worker error" : String(error);

        logger.error(`Worker ${name} error: ${errorMessage}`);
        this.status.set(name, WorkerStatus.ERROR);

        // Increment error count
        const currentErrorCount = this.errorCounts.get(name) || 0;
        this.errorCounts.set(name, currentErrorCount + 1);

        // Attempt to recover the worker
        this.attemptWorkerRecovery(name);
    }

    /**
     * Attempt to recover a worker that has encountered errors
     * @param name Worker name
     */
    private attemptWorkerRecovery(name: string): void {
        const errorCount = this.errorCounts.get(name) || 0;
        const worker = this.workers.get(name);

        if (!worker) {
            logger.warn(`Cannot recover non-existent worker: ${name}`);
            return;
        }

        if (errorCount <= this.maxRetries) {
            logger.info(`Attempting to recover worker ${name} (attempt ${errorCount}/${this.maxRetries})`);

            // Wait a bit before restarting to avoid rapid restart loops
            setTimeout(() => {
                if (this.status.get(name) === WorkerStatus.ERROR) {
                    // Get the worker's configuration
                    worker.postMessage({
                        type: WorkerMessageType.STOP,
                    });

                    // Set status to idle and then restart
                    this.status.set(name, WorkerStatus.IDLE);
                    this.startWorker(name);

                    logger.info(`Worker ${name} recovered after error`);
                }
            }, this.restartTimeout);
        } else {
            logger.error(`Worker ${name} has failed too many times (${errorCount}), not attempting further recovery`);
            // Could terminate or reset the worker here if needed
        }
    }

    /**
     * Handle messages from workers
     * @param name Worker name
     * @param message Worker message
     */
    private handleWorkerMessage(name: string, message: WorkerMessage): void {
        switch (message.type) {
            case WorkerMessageType.LOG:
                logger.info(`[Worker ${name}] ${message.data}`);
                break;

            case WorkerMessageType.ERROR:
                logger.error(`[Worker ${name} ERROR] ${message.data}`);

                // Only update status if currently running (allow initialization errors to be handled without changing state)
                if (this.status.get(name) === WorkerStatus.RUNNING) {
                    this.status.set(name, WorkerStatus.ERROR);

                    // Track error and attempt recovery
                    const errorCount = this.errorCounts.get(name) || 0;
                    this.errorCounts.set(name, errorCount + 1);
                    this.attemptWorkerRecovery(name);
                }
                break;

            case WorkerMessageType.START_FAILED:
                logger.error(`[Worker ${name} START FAILED] ${message.data}`);
                // Startup failed, terminate worker without attempting recovery
                logger.warn(`Agent ${name} failed to start, terminating without retry`);
                this.terminateWorker(name);
                break;

            case WorkerMessageType.RESULT:
                // Reset error count on successful results
                this.errorCounts.set(name, 0);
                logger.info(`[Worker ${name} RESULT] ${JSON.stringify(message.data)}`);
                break;

            case WorkerMessageType.SEND:
                gameService.sendBotMessage(name, message.data);
                logger.info(`[Worker ${name} SEND] ${message.data.type}`);
                break;

            default:
                logger.info(`[Worker ${name} UNKNOWN] ${JSON.stringify(message)}`);
        }
    }

    /**
     * Start a specific worker
     * @param name Worker name
     * @returns Success status
     */
    public startWorker(name: string): boolean {
        const worker = this.workers.get(name);
        const status = this.status.get(name);

        if (worker && (status === WorkerStatus.IDLE || status === WorkerStatus.ERROR)) {
            worker.postMessage({
                type: WorkerMessageType.START,
            });
            this.status.set(name, WorkerStatus.RUNNING);
            logger.info(`Worker ${name} started`);
            return true;
        }

        if (!worker) {
            logger.error(`Cannot start non-existent worker: ${name}`);
        } else {
            logger.warn(`Cannot start worker ${name} in status: ${status}`);
        }

        return false;
    }

    /**
     * Stop a specific worker
     * @param name Worker name
     * @returns Success status
     */
    public stopWorker(name: string): boolean {
        const worker = this.workers.get(name);
        if (worker && (this.status.get(name) === WorkerStatus.RUNNING || this.status.get(name) === WorkerStatus.ERROR)) {
            worker.postMessage({
                type: WorkerMessageType.STOP,
            });
            this.status.set(name, WorkerStatus.IDLE);
            logger.info(`Worker ${name} stopped`);
            return true;
        }
        return false;
    }

    /**
     * Terminate a worker
     * @param name Worker name
     * @returns Success status
     */
    public terminateWorker(name: string): boolean {
        const worker = this.workers.get(name);
        if (worker) {
            try {
                worker.terminate();
                this.workers.delete(name);
                this.status.set(name, WorkerStatus.TERMINATED);
                this.errorCounts.delete(name);
                logger.info(`Worker ${name} terminated`);
                return true;
            } catch (error) {
                logger.error(`Error terminating worker ${name}: ${error}`);
                this.status.set(name, WorkerStatus.ERROR);
                return false;
            }
        }
        return false;
    }

    /**
     * Restart a worker with provided configuration
     * @param name Worker name
     * @param config Bot configuration
     * @returns Success status
     */
    public restartWorker(name: string, config?: BotConfig): boolean {
        // If no config is provided, reuse the existing config if possible
        if (!config && this.workers.has(name)) {
            // Implementation note: In reality, we would need to store workers' configs separately
            // This is a placeholder for demonstration purposes
            logger.warn(`Restarting worker ${name} without configuration`);
        }

        if (this.terminateWorker(name)) {
            // Reset error count
            this.errorCounts.set(name, 0);

            // Create and start worker
            if (config) {
                this.createWorker(name, config);
                return this.startWorker(name);
            } else {
                logger.error(`Cannot restart worker ${name}: No configuration provided`);
                return false;
            }
        }
        return false;
    }

    /**
     * Start all workers
     */
    public startAllWorkers(): void {
        for (const name of this.workers.keys()) {
            this.startWorker(name);
        }
    }

    /**
     * Stop all workers
     */
    public stopAllWorkers(): void {
        for (const name of this.workers.keys()) {
            this.stopWorker(name);
        }
    }

    /**
     * Terminate all workers
     */
    public terminateAllWorkers(): void {
        for (const name of this.workers.keys()) {
            this.terminateWorker(name);
        }
    }

    /**
     * Send a task to a worker
     * @param name Worker name
     * @param task Task data
     * @returns Success status
     */
    public sendTask(name: string, task: unknown): boolean {
        const worker = this.workers.get(name);
        const status = this.status.get(name);

        if (worker && status === WorkerStatus.RUNNING) {
            worker.postMessage({
                type: WorkerMessageType.TASK,
                data: task,
            });
            return true;
        }

        if (status === WorkerStatus.ERROR) {
            logger.warn(`Cannot send task to worker ${name} in ERROR state`);
        }

        return false;
    }

    /**
     * Get worker status
     * @param name Worker name
     * @returns Worker status or undefined if worker doesn't exist
     */
    public getWorkerStatus(name: string): WorkerStatus | undefined {
        return this.status.get(name);
    }

    /**
     * Get all worker names
     * @returns Array of worker names
     */
    public getWorkerNames(): string[] {
        return Array.from(this.workers.keys());
    }

    /**
     * Check if a worker is healthy
     * @param name Worker name
     * @returns Whether the worker is healthy
     */
    public isWorkerHealthy(name: string): boolean {
        const status = this.status.get(name);
        return status === WorkerStatus.IDLE || status === WorkerStatus.RUNNING;
    }

    /**
     * Get all unhealthy worker names
     * @returns Array of unhealthy worker names
     */
    public getUnhealthyWorkers(): string[] {
        return Array.from(this.status.entries())
            .filter(([_, status]) => status === WorkerStatus.ERROR)
            .map(([name, _]) => name);
    }

    /**
     * Dispose all resources
     */
    public dispose(): void {
        this.terminateAllWorkers();
        this.workers.clear();
        this.status.clear();
        this.errorCounts.clear();
    }
}
