/**
 * Logger Module
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

/**
 * Logger class for application logging
 */
export class Logger {
    private static instance: Logger;
    private level: LogLevel = LogLevel.INFO;
    private prefix: string = "";

    /**
     * Constructor for Logger
     */
    private constructor(prefix: string = "") {
        this.prefix = prefix;
    }

    /**
     * Get the singleton instance of Logger
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Create a new logger with a prefix
     */
    public withPrefix(prefix: string): Logger {
        const newLogger = new Logger(prefix);
        newLogger.level = this.level;
        return newLogger;
    }

    /**
     * Set log level
     */
    setLevel(level: string): void {
        switch (level.toUpperCase()) {
            case "DEBUG":
                this.level = LogLevel.DEBUG;
                break;
            case "INFO":
                this.level = LogLevel.INFO;
                break;
            case "WARN":
                this.level = LogLevel.WARN;
                break;
            case "ERROR":
                this.level = LogLevel.ERROR;
                break;
            default:
                this.level = LogLevel.INFO;
        }
    }

    /**
     * Format log message
     */
    private format(level: string, message: string): string {
        const timestamp = new Date().toISOString();
        return this.prefix ? `[${timestamp}] [${level}] [${this.prefix}] ${message}` : `[${timestamp}] [${level}] ${message}`;
    }

    /**
     * Log debug message
     */
    debug(message: string): void {
        if (this.level <= LogLevel.DEBUG) {
            console.debug(this.format("DEBUG", message));
        }
    }

    /**
     * Log info message
     */
    info(message: string): void {
        if (this.level <= LogLevel.INFO) {
            console.info(this.format("INFO", message));
        }
    }

    /**
     * Log warning message
     */
    warn(message: string): void {
        if (this.level <= LogLevel.WARN) {
            console.warn(this.format("WARN", message));
        }
    }

    /**
     * Log error message
     */
    error(message: string, error?: Error): void {
        if (this.level <= LogLevel.ERROR) {
            const formattedMessage = error
                ? `${this.format("ERROR", message)}\n${error.stack || error.message}`
                : this.format("ERROR", message);

            console.error(formattedMessage);
        }
    }
}

// Create and export singleton instance
export const logger = Logger.getInstance();
export default logger;
