import { WorkerManager } from "@/worker/manager.ts";
import { WebSocketClient } from "@/server/websocket.ts";
import "./game-listener.ts";
import "./game-messager.ts";
import { GameService } from "@/server/game.ts";
import { Application, Context, Router } from "@oak/oak";
import { logger } from "@/utils/logger.ts";
import config from "@/config.ts";

/**
 * Server class for handling Minecraft AI Agent HTTP requests
 * Uses Oak framework for routing and middleware
 */

const TEST_Token =
    "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJibG9jay1hc3Nhc3Npbi1zZXJ2ZXIiLCJzdWIiOiI0MTVlOGM4ZC0yZDNlLTQwZmQtOGE2MC1jNTNkYjFmMTZiN2QiLCJleHAiOjE3NDM2OTg1NjQsInJvbGUiOiJhZG1pbiIsInR5cGUiOiJ3c19hY2Nlc3MifQ.pMkkl0DowfkEX9aBhFYKJxroueUxydLGJhm9cHMdoeiLLEK3EPSy0sPbFn4gO7udBY9iY7v1TNFhixthXtxNMg";

class Server {
    private hostname: string;
    private port: number;
    private workerManager: WorkerManager;
    private webSocketClient: WebSocketClient;
    private gameService: GameService;

    private app: Application;
    private router: Router;

    /**
     * Constructor for the Server class
     * @param settings - Settings containing host and port configuration
     * @param workerManager - Worker manager instance for handling agent tasks
     */
    constructor() {
        this.hostname = config.settings.host;
        this.port = config.settings.port;
        this.workerManager = WorkerManager.getInstance();
        this.webSocketClient = WebSocketClient.getInstance();
        this.gameService = GameService.getInstance();

        this.app = new Application();
        this.router = new Router();

        this.setupRoutes();
        this.setupWebSocket();
    }

    /**
     * Set up the server routes
     */
    private setupRoutes() {
        // Route for starting the agent
        this.router.get("/start", (ctx: Context) => {
            this.workerManager.initWorkers(Object.values(config.bots));
            this.workerManager.startAllWorkers();

            ctx.response.body = {
                status: "success",
                message: "Agent task started",
            };
            ctx.response.type = "application/json";
        });

        // Default route
        this.router.get("/", (ctx: Context) => {
            ctx.response.body = "Minecraft AI Agent Server";
            ctx.response.type = "text/plain";
        });

        // Apply router middleware
        this.app.use(this.router.routes());
        this.app.use(this.router.allowedMethods());

        // Add 404 handler for unmatched routes
        this.app.use((ctx: Context) => {
            ctx.response.status = 404;
            ctx.response.body = { error: "Not Found" };
            ctx.response.type = "application/json";
        });
    }

    private setupWebSocket() {
        this.webSocketClient.setAuthToken(TEST_Token);
        this.webSocketClient.onMessage((message) => {
            logger.info(`received message: ${JSON.stringify(message)}`);
        });
        this.webSocketClient.onClose(() => {
            this.workerManager.stopAllWorkers();
        });

        this.gameService.registerMessageHandlers();
    }

    /**
     * Start the HTTP server using Oak
     */
    public async start() {
        logger.info(`Server starting on ${this.hostname}:${this.port}`);
        this.app.listen({
            hostname: this.hostname,
            port: this.port,
        });

        await this.webSocketClient.connect();
    }
}

export default Server;
