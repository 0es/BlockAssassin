/**
 * Game Service
 * Handles game-related WebSocket messages and game state management.
 */
import { logger } from "@/utils/logger.ts";
import { WebSocketClient } from "../server/websocket.ts";

const gameLogger = logger.withPrefix("Game Service");

export enum GameReceivedMessageType {
    BOTS_INIT = "botsInit",
}

export enum GameSentMessageType {
    BOT_HUDSYNC = "botHUDSync",
}
export type GameReceivedMessage = {
    type: GameReceivedMessageType;
    data: Record<string, unknown> | unknown[];
};
export type GameSentMessage = {
    type: GameSentMessageType;
    data: Record<string, unknown> | unknown[];
};

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

    public async sendBotMessage(bot: string, data: GameSentMessage) {
        const dataType = data.type;
        const dataContent = data.data;

        switch (dataType) {
            case GameSentMessageType.BOT_HUDSYNC:
                await this.handleBotHUDSync(bot, (dataContent as { hudStr: string }).hudStr);
                break;
            default:
                await this.wsClient.send({ type: dataType, data: { bot, ...(data.data || {}) } });
        }
    }

    // Register WebSocket message handlers
    public registerMessageHandlers(): void {
        this.wsClient.onMessage(this.handleMessage.bind(this));
        gameLogger.info("WebSocket message handlers registered");
    }

    // Handle incoming WebSocket messages
    private async handleMessage(message: GameReceivedMessage): Promise<void> {
        // Check if the message is a game-related message
        if (!message || !message.type) {
            return;
        }

        const messageType = message.type;
        const messageData = message.data;

        gameLogger.debug(`Handling message type: ${messageType}`);

        switch (messageType) {
            case GameReceivedMessageType.BOTS_INIT:
                await this.handleBotsInit(messageData as { name: string }[]);
                break;
            default:
                gameLogger.debug(`Unhandled message type: ${messageType}`);
                break;
        }
    }

    // Additional game service methods can be added here
}
