/**
 * Game Service
 * Handles game-related WebSocket messages and game state management.
 */
import { logger } from "@/utils/logger.ts";
import { WebSocketClient } from "./websocket.ts";
import { WorkerSendData } from "@/worker/manager.ts";

/**
 * Game Service class
 * Manages game state and handles game-related WebSocket messages
 */
export class GameService {
    private static instance: GameService;
    public wsClient: WebSocketClient;
    public botsConfigPath: string;

    // Private constructor for singleton pattern
    private constructor() {
        this.wsClient = WebSocketClient.getInstance();
        this.botsConfigPath = Deno.cwd() + "/config/bots";
    }

    // Get singleton instance
    public static getInstance(): GameService {
        if (!GameService.instance) {
            GameService.instance = new GameService();
        }
        return GameService.instance;
    }

    public async sendBotMessage(bot: string, data: WorkerSendData) {
        const dataType = data.type;

        switch (dataType) {
            default:
                await this.wsClient.send({ type: dataType, data: { bot, ...(data.data || {}) } });
        }
    }

    // Register WebSocket message handlers
    public registerMessageHandlers(): void {
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

    // Additional game service methods can be added here
}

export default GameService.getInstance();
