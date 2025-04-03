import { LogLevel } from "@/utils/logger.ts";
import { WorkerMessageType } from "@/worker/manager.ts";

const workerContext = self;

/**
 * This logger is specifically designed for agents running in worker environments.
 * It forwards log messages to the main thread using postMessage for centralized logging.
 */
export class Logger {
    private static instance: Logger;
    private level: LogLevel = LogLevel.INFO;

    private constructor() {}

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Log debug message
     */
    debug(message: string): void {
        workerContext.postMessage({
            type: WorkerMessageType.LOG,
            logLevel: LogLevel.DEBUG,
            data: message,
        });
    }

    /**
     * Log info message
     */
    info(message: string): void {
        workerContext.postMessage({
            type: WorkerMessageType.LOG,
            logLevel: LogLevel.INFO,
            data: message,
        });
    }

    /**
     * Log warning message
     */
    warn(message: string): void {
        workerContext.postMessage({
            type: WorkerMessageType.LOG,
            logLevel: LogLevel.WARN,
            data: message,
        });
    }

    /**
     * Log error message
     */
    error(message: string, error?: Error): void {
        if (this.level <= LogLevel.ERROR) {
            const formattedMessage = error ? `${message}\n${error.stack || error.message}` : message;

            workerContext.postMessage({
                type: WorkerMessageType.LOG,
                logLevel: LogLevel.ERROR,
                data: formattedMessage,
            });
        }
    }
}

export const logger = Logger.getInstance();
export default logger;
