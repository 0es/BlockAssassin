/**
 * WebSocket Client Implementation
 * Handles WebSocket communication with the BlockAssassin server.
 */
import { WebSocket } from "ws";
import { logger } from "@/utils/logger.ts";
import { Config } from "@/config.ts";
import { ClientMessageEncryptor } from "@/utils/crypto.ts";
import { GameReceivedMessage } from "@/game/index.ts";

const wsLogger = logger.withPrefix("WebSocket");

// WebSocket connection states
enum ConnectionState {
    DISCONNECTED = "disconnected",
    CONNECTING = "connecting",
    CONNECTED = "connected",
    AUTHENTICATING = "authenticating",
    AUTHENTICATED = "authenticated",
    RECONNECTING = "reconnecting",
    ERROR = "error",
}

// WebSocket close codes, matching server-side codes
export enum WebSocketCloseCode {
    NORMAL_CLOSURE = 1000,
    SERVER_SHUTDOWN = 1001,
    INTERNAL_ERROR = 1011,
    MAX_CONNECTIONS_REACHED = 1013,
    AUTH_ERROR = 4000, // Authentication errors (token invalid, format error, missing claims, etc.)
    CONNECTION_TIMEOUT = 4001, // Connection timed out (no messages received)
    DUPLICATE_CONNECTION = 4002, // User connected from another device/session
}

export type ReceivedMessage = GameReceivedMessage;

// WebSocket event handlers type definitions
type MessageHandler = (message: GameReceivedMessage) => void;
type ConnectionHandler = () => void;
type ErrorHandler = (error: Error) => void;
type CloseHandler = (code: number, reason: string) => void;

/**
 * WebSocket Client Manager
 */
export class WebSocketClient {
    private static instance: WebSocketClient;
    private socket: WebSocket | null = null;
    private encryptor: ClientMessageEncryptor;
    private state: ConnectionState = ConnectionState.DISCONNECTED;
    private serverUrl: string;
    private authToken: string | null = null;
    private clientId: string | null = null;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 10;
    private reconnectTimeout: number | null = null;
    private pingInterval: number | null = null;
    private lastPingTime: number = 0;

    // Event handlers
    private messageHandlers: MessageHandler[] = [];
    private connectionHandlers: ConnectionHandler[] = [];
    private errorHandlers: ErrorHandler[] = [];
    private closeHandlers: CloseHandler[] = [];

    // Private constructor for singleton pattern
    private constructor() {
        const config = Config.getInstance();

        // Build WebSocket server URL
        const serverHost = config.settings.websocket?.host || "localhost";
        const serverPort = config.settings.websocket?.port || 8888;
        this.serverUrl = `ws://${serverHost}:${serverPort}/ws`;

        // Initialize encryptor
        const publicKeyPath = config.settings.websocket?.pem?.serverPublicKey || "./ba_server_public.pem";
        const privateKeyPath = config.settings.websocket?.pem?.clientPrivateKey || "./ba_client_private.pem";

        this.encryptor = new ClientMessageEncryptor(
            "RSA",
            publicKeyPath,
            privateKeyPath,
        );
    }

    // Get singleton instance
    public static getInstance(): WebSocketClient {
        if (!WebSocketClient.instance) {
            WebSocketClient.instance = new WebSocketClient();
        }
        return WebSocketClient.instance;
    }

    // Set authentication token
    public setAuthToken(token: string): void {
        this.authToken = token;
        wsLogger.info("Authentication token set");
    }

    // Connect to WebSocket server
    public connect(): boolean {
        const invalidStates = [
            ConnectionState.CONNECTED,
            ConnectionState.CONNECTING,
            ConnectionState.AUTHENTICATING,
        ];

        if (invalidStates.includes(this.state)) {
            wsLogger.warn(`Cannot connect while in ${this.state} state`);
            return false;
        }

        if (!this.authToken) {
            wsLogger.error("Cannot connect: No authentication token provided");
            return false;
        }

        try {
            this.state = ConnectionState.CONNECTING;
            wsLogger.info(`Connecting to WebSocket server: ${this.serverUrl}`);

            // Create WebSocket connection
            this.socket = new WebSocket(this.serverUrl, undefined, { followRedirects: true });

            // Set up event handlers
            this.socket.addEventListener("open", this.handleOpen.bind(this));
            this.socket.addEventListener("message", this.handleMessage.bind(this));
            this.socket.addEventListener("error", this.handleError.bind(this));
            this.socket.addEventListener("close", this.handleClose.bind(this));

            wsLogger.info(`WebSocket client connected to server URL: ${this.serverUrl}`);

            return true;
        } catch (error) {
            this.state = ConnectionState.ERROR;
            wsLogger.error("Failed to connect to WebSocket server", error as Error);
            this.triggerErrorHandlers(error as Error);
            return false;
        }
    }

    // Disconnect from WebSocket server
    public disconnect(reason: string = "Client disconnected"): void {
        if (this.state === ConnectionState.DISCONNECTED) {
            return;
        }

        wsLogger.info(`Disconnecting from WebSocket server: ${reason}`);

        this.clearTimers();

        if (this.socket) {
            try {
                this.socket.close(WebSocketCloseCode.NORMAL_CLOSURE, reason);
            } catch (error) {
                wsLogger.error("Error while closing WebSocket connection", error as Error);
            }
            this.socket = null;
        }

        this.state = ConnectionState.DISCONNECTED;
    }

    // Clear all timers
    private clearTimers(): void {
        if (this.pingInterval !== null) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        if (this.reconnectTimeout !== null) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    // Handle WebSocket open event
    private handleOpen(): void {
        wsLogger.info("WebSocket connection established");
        this.state = ConnectionState.AUTHENTICATING;
        this.reconnectAttempts = 0;
        this.authenticate();
    }

    // Send authentication message
    private async authenticate(): Promise<void> {
        if (this.state !== ConnectionState.AUTHENTICATING || !this.socket || !this.authToken) {
            return;
        }

        try {
            const authMessage = {
                type: "auth",
                token: this.authToken,
                clientInfo: {
                    version: "BlockAssassin-Client/1.0",
                    platform: Deno.build?.os || "unknown",
                    arch: Deno.build?.arch || "unknown",
                    hostname: Deno.hostname?.() || "unknown",
                    timestamp: new Date().toISOString(),
                },
            };

            await this.send(authMessage);
            wsLogger.info("Authentication message sent with client info");
        } catch (error) {
            wsLogger.error("Failed to send authentication message", error as Error);
            this.disconnect("Authentication error");
        }
    }

    // Handle WebSocket message event
    private async handleMessage(event: MessageEvent): Promise<void> {
        try {
            const data = event.data.toString();

            // Log received message (truncated for large messages)
            const truncatedData = data.length > 100 ? data.substring(0, 100) + "..." : data;
            wsLogger.debug(`Received WebSocket data: ${truncatedData}`);

            // Update last communication time
            this.lastPingTime = Date.now();

            if (this.state === ConnectionState.AUTHENTICATING) {
                await this.handleAuthMessage(data);
            } else if (this.state === ConnectionState.AUTHENTICATED) {
                await this.handleDataMessage(data);
            }
        } catch (error) {
            wsLogger.error("Error handling WebSocket message", error as Error);
        }
    }

    // Handle authentication messages
    private async handleAuthMessage(data: string): Promise<void> {
        try {
            // Decrypt authentication response
            const decryptedData = await this.encryptor.decrypt(data);
            const message = JSON.parse(decryptedData);

            wsLogger.debug(`Decrypted message: ${JSON.stringify(message)}`);

            if (message.type === "welcome") {
                this.state = ConnectionState.AUTHENTICATED;
                this.clientId = message.data.clientId;

                wsLogger.info(`Authentication successful, client ID: ${this.clientId}`);
                this.startPingInterval();
                this.triggerConnectionHandlers();
            }
        } catch (error) {
            wsLogger.error("Failed to process authentication response", error as Error);
        }
    }

    // Handle data messages after authentication
    private async handleDataMessage(data: string): Promise<void> {
        try {
            // Decrypt message
            const decryptedData = await this.encryptor.decrypt(data);

            // Parse JSON
            const message = JSON.parse(decryptedData);

            // Log message type
            wsLogger.debug(`Received message type: ${message.type || "unknown"}`);

            // Handle ping & pong messages
            if (message.type === "ping") {
                this.handlePing();
                return;
            } else if (message.type === "pong") {
                return;
            }

            // Notify all message handlers for other message types
            this.triggerMessageHandlers(message);
        } catch (error) {
            wsLogger.error("Message processing error", error as Error);
        }
    }

    // Handle ping message
    private async handlePing(): Promise<void> {
        try {
            await this.send({
                type: "pong",
                timestamp: Date.now(),
            });
        } catch (error) {
            wsLogger.error("Failed to send pong", error as Error);
            // Attempt reconnect on failure
            this.reconnect();
        }
    }

    // Start ping interval
    private startPingInterval(): void {
        // 30 second ping interval
        const pingIntervalMs = 30000;

        this.pingInterval = setInterval(() => {
            const now = Date.now();

            // Reconnect if no message received for 2 minutes
            if (now - this.lastPingTime > 120000) {
                wsLogger.warn("WebSocket connection timeout, reconnecting");
                this.reconnect();
                return;
            }

            // Send simple ping message
            this.send({
                type: "ping",
                timestamp: now,
            }).catch((error) => {
                wsLogger.error("Failed to send ping", error as Error);
                // Trigger reconnect on failure
                this.reconnect();
            });
        }, pingIntervalMs);
    }

    // Handle WebSocket error event
    private handleError(event: Event | ErrorEvent): void {
        const errorMessage = (event as ErrorEvent).message || "Unknown WebSocket error";
        const error = new Error(errorMessage);

        wsLogger.error(`WebSocket error: ${errorMessage}`);
        this.state = ConnectionState.ERROR;
        this.triggerErrorHandlers(error);
        this.reconnect();
    }

    // Handle WebSocket close event
    private handleClose(event: CloseEvent): void {
        wsLogger.info(`WebSocket connection closed: ${event.code} - ${event.reason}`);

        this.clearTimers();
        this.state = ConnectionState.DISCONNECTED;
        this.triggerCloseHandlers(event.code, event.reason);

        // Do not attempt to reconnect for normal closure or authentication errors
        if (
            event.code === WebSocketCloseCode.NORMAL_CLOSURE ||
            event.code === WebSocketCloseCode.AUTH_ERROR
        ) {
            wsLogger.info(
                `No reconnect attempt: ${event.code === WebSocketCloseCode.NORMAL_CLOSURE ? "Normal closure" : "Authentication error"}`,
            );
            return;
        }

        // Attempt reconnect for other non-intentional disconnects
        this.reconnect();
    }

    // Attempt to reconnect to the server
    private reconnect(): void {
        if (this.state === ConnectionState.RECONNECTING) {
            return;
        }

        this.clearTimers();
        this.state = ConnectionState.RECONNECTING;
        this.reconnectAttempts++;

        if (this.reconnectAttempts > this.maxReconnectAttempts) {
            wsLogger.error("Maximum reconnection attempts reached");
            this.state = ConnectionState.DISCONNECTED;
            return;
        }

        // Calculate exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000, 30000);

        wsLogger.info(
            `Reconnecting in ${Math.round(delay / 1000)} seconds (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
        );

        this.reconnectTimeout = setTimeout(() => this.connect(), delay);
    }

    // Send message to the server
    public send(message: any): Promise<void> {
        // Log message type before sending
        const msgType = typeof message === "object" && message.type ? message.type : "unknown";
        wsLogger.debug(`Sending message type: ${msgType}`);

        // Convert message to JSON string
        const jsonMessage = JSON.stringify(message);
        return this.sendRaw(jsonMessage);
    }

    // Send raw message to the server
    private async sendRaw(message: string): Promise<void> {
        if (!this.socket) {
            throw new Error("Cannot send message: No WebSocket connection");
        }

        try {
            // Log raw message for debugging (only first 100 chars)
            const truncatedMsg = message.length > 100 ? message.substring(0, 100) + "..." : message;
            wsLogger.debug(`Sending raw data: ${truncatedMsg}`);

            // Encrypt message
            const encryptedMessage = await this.encryptor.encrypt(message);

            // Log encrypted size
            wsLogger.debug(`Encrypted message size: ${encryptedMessage.length} bytes`);

            // Send via WebSocket
            this.socket.send(encryptedMessage);
        } catch (error) {
            wsLogger.error("Failed to send message", error as Error);
            throw error;
        }
    }

    // Register message handler
    public onMessage(handler: MessageHandler): void {
        this.messageHandlers.push(handler);
    }

    // Register connection handler
    public onConnect(handler: ConnectionHandler): void {
        this.connectionHandlers.push(handler);
    }

    // Register error handler
    public onError(handler: ErrorHandler): void {
        this.errorHandlers.push(handler);
    }

    // Register close handler
    public onClose(handler: CloseHandler): void {
        this.closeHandlers.push(handler);
    }

    // Trigger message handlers
    private triggerMessageHandlers(message: GameReceivedMessage): void {
        for (const handler of this.messageHandlers) {
            try {
                handler(message);
            } catch (error) {
                wsLogger.error("Error in message handler", error as Error);
            }
        }
    }

    // Trigger connection handlers
    private triggerConnectionHandlers(): void {
        for (const handler of this.connectionHandlers) {
            try {
                handler();
            } catch (error) {
                wsLogger.error("Error in connection handler", error as Error);
            }
        }
    }

    // Trigger error handlers
    private triggerErrorHandlers(error: Error): void {
        for (const handler of this.errorHandlers) {
            try {
                handler(error);
            } catch (handlerError) {
                wsLogger.error("Error in error handler", handlerError as Error);
            }
        }
    }

    // Trigger close handlers
    private triggerCloseHandlers(code: number, reason: string): void {
        for (const handler of this.closeHandlers) {
            try {
                handler(code, reason);
            } catch (error) {
                wsLogger.error("Error in close handler", error as Error);
            }
        }
    }

    // Get the current connection state
    public getState(): ConnectionState {
        return this.state;
    }

    // Get client ID
    public getClientId(): string | null {
        return this.clientId;
    }

    // Check if connection is authenticated
    public isAuthenticated(): boolean {
        return this.state === ConnectionState.AUTHENTICATED;
    }
}

// Export connection state enum
export { ConnectionState };
