import { BotConfig } from "@/config.ts";

/**
 * Agent worker status
 */
export enum WorkerStatus {
    IDLE = "idle",
    RUNNING = "running",
    ERROR = "error",
    TERMINATED = "terminated"
}

/**
 * Worker message types
 */
export enum WorkerMessageType {
    INIT = "init",
    START = "start",
    STOP = "stop",
    TASK = "task",
    RESULT = "result",
    ERROR = "error",
    LOG = "log"
}

/**
 * Worker message interface
 */
export interface WorkerMessage {
    type: WorkerMessageType;
    data?: unknown;
}

/**
 * Manages multiple agent workers
 */
export class WorkerManager {
    private workers: Map<string, Worker>;
    private status: Map<string, WorkerStatus>;
    private workerModulePath: string;

    /**
     * Create a new WorkerManager
     * @param workerModulePath Path to the worker module
     */
    constructor(workerModulePath: string = new URL("./thread.ts", import.meta.url).href) {
        this.workers = new Map();
        this.status = new Map();
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
            console.error("Worker initialization failed: config missing name");
            return false;
        }

        // Terminate existing worker with same name if exists
        if (this.workers.has(config.name)) {
            this.terminateWorker(config.name);
        }

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
                    },
                },
            });

            // Setup message handling
            worker.addEventListener("message", (event) => {
                this.handleWorkerMessage(name, event.data as WorkerMessage);
            });

            worker.addEventListener("error", (error) => {
                console.error(`Worker ${name} error:`, error);
                this.status.set(name, WorkerStatus.ERROR);
            });

            // Store the worker
            this.workers.set(name, worker);
            this.status.set(name, WorkerStatus.IDLE);

            // Initialize the worker with configuration
            worker.postMessage({
                type: WorkerMessageType.INIT,
                data: config
            });

            console.log(`Worker ${name} created`);
        } catch (error) {
            console.error(`Failed to create worker ${name}:`, error);
            this.status.set(name, WorkerStatus.ERROR);
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
                console.log(`[Worker ${name}]`, message.data);
                break;
            case WorkerMessageType.ERROR:
                console.error(`[Worker ${name} ERROR]`, message.data);
                this.status.set(name, WorkerStatus.ERROR);
                break;
            case WorkerMessageType.RESULT:
                console.log(`[Worker ${name} RESULT]`, message.data);
                break;
            default:
                console.log(`[Worker ${name} UNKNOWN]`, message);
        }
    }

    /**
     * Start a specific worker
     * @param name Worker name
     * @returns Success status
     */
    public startWorker(name: string): boolean {
        const worker = this.workers.get(name);
        if (worker && this.status.get(name) === WorkerStatus.IDLE) {
            worker.postMessage({
                type: WorkerMessageType.START
            });
            this.status.set(name, WorkerStatus.RUNNING);
            console.log(`Worker ${name} started`);
            return true;
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
        if (worker && this.status.get(name) === WorkerStatus.RUNNING) {
            worker.postMessage({
                type: WorkerMessageType.STOP
            });
            this.status.set(name, WorkerStatus.IDLE);
            console.log(`Worker ${name} stopped`);
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
            worker.terminate();
            this.workers.delete(name);
            this.status.set(name, WorkerStatus.TERMINATED);
            console.log(`Worker ${name} terminated`);
            return true;
        }
        return false;
    }

    /**
     * Restart a worker with provided configuration
     * @param name Worker name
     * @param config Bot configuration
     * @returns Success status
     */
    public async restartWorker(name: string, config: BotConfig): Promise<boolean> {
        if (this.terminateWorker(name)) {
            await this.createWorker(name, config);
            return this.startWorker(name);
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
        if (worker && this.status.get(name) === WorkerStatus.RUNNING) {
            worker.postMessage({
                type: WorkerMessageType.TASK,
                data: task
            });
            return true;
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
     * Dispose all resources
     */
    public dispose(): void {
        this.terminateAllWorkers();
        this.workers.clear();
        this.status.clear();
    }
}
