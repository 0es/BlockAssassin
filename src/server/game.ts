/**
 * Game Service
 * Handles game-related WebSocket messages and game state management.
 */
import { logger } from "@/utils/logger.ts";
import { Config } from "@/config.ts";
import { WebSocketClient } from "./websocket.ts";

/**
 * Game Service class
 * Manages game state and handles game-related WebSocket messages
 */
export class GameService {
    private static instance: GameService;
    private wsClient: WebSocketClient;
    private config: Config;
    private botsConfigPath: string;

    // Private constructor for singleton pattern
    private constructor() {
        this.wsClient = WebSocketClient.getInstance();
        this.config = Config.getInstance();
        this.botsConfigPath = Deno.cwd() + "/config/bots";
    }

    // Get singleton instance
    public static getInstance(): GameService {
        if (!GameService.instance) {
            GameService.instance = new GameService();
        }
        return GameService.instance;
    }

    // Register WebSocket message handlers
    registerMessageHandlers(): void {
        this.wsClient.onMessage(this.handleMessage.bind(this));
        logger.info("Game Service: WebSocket message handlers registered");
    }

    // Handle incoming WebSocket messages
    private async handleMessage(message: any): Promise<void> {
        // Check if the message is a game-related message
        if (!message || !message.type) {
            return;
        }

        logger.debug(`Game Service: Handling message type: ${message.type}`);

        switch (message.type) {
            case "botsInit":
                await this.handleBotsInit(message);
                break;
            // Add more message type handlers here
            default:
                logger.debug(`Game Service: Unhandled message type: ${message.type}`);
                break;
        }
    }

    // Handle botsInit message
    private async handleBotsInit(message: any): Promise<void> {
        try {
            if (!message.data || !Array.isArray(message.data)) {
                logger.error("Game Service: Invalid botsInit message format - missing data array");
                return;
            }

            logger.info(`Game Service: Initializing bots (${message.data.length} bots)`);

            // Ensure bots directory exists
            try {
                await Deno.mkdir(this.botsConfigPath, { recursive: true });
            } catch (error) {
                if (!(error instanceof Deno.errors.AlreadyExists)) {
                    throw error;
                }
            }

            // Clean existing bot configurations by removing all files in directory
            for await (const entry of Deno.readDir(this.botsConfigPath)) {
                if (entry.isFile) {
                    await Deno.remove(`${this.botsConfigPath}/${entry.name}`);
                }
            }
            logger.info(`Game Service: Cleaned bots directory: ${this.botsConfigPath}`);

            // Create new bot configuration files
            for (const botConfig of message.data) {
                if (!botConfig.name) {
                    logger.warn("Game Service: Bot configuration missing name, skipping");
                    continue;
                }

                const botFilePath = `${this.botsConfigPath}/${botConfig.name}.json`;

                try {
                    await Deno.writeTextFile(botFilePath, JSON.stringify(botConfig, null, 2));
                    logger.info(`Game Service: Created bot configuration for bot ${botConfig.name}`);
                } catch (error) {
                    logger.error(`Game Service: Failed to write bot configuration file: ${botFilePath}`, error as Error);
                }
            }

            logger.info(`Game Service: Bot initialization completed (${message.data.length} bots)`);
        } catch (error) {
            logger.error("Game Service: Error handling botsInit message", error as Error);
        }
    }

    // Additional game service methods can be added here
}
