import { Settings, Config } from "@/config.ts";
import { WorkerManager } from "@/worker/manager.ts";
import { Application, Context, Router } from "@oak/oak";

/**
 * Server class for handling Minecraft AI Agent HTTP requests
 * Uses Oak framework for routing and middleware
 */
class Server {
    private hostname: string;
    private port: number;
    private workerManager: WorkerManager;
    private app: Application;
    private router: Router;

    /**
     * Constructor for the Server class
     * @param settings - Settings containing host and port configuration
     * @param workerManager - Worker manager instance for handling agent tasks
     */
    constructor(settings: Settings, workerManager: WorkerManager) {
        this.hostname = settings.host;
        this.port = settings.port;
        this.workerManager = workerManager;

        this.app = new Application();
        this.router = new Router();

        this.setupRoutes();
    }

    /**
     * Set up the server routes
     */
    private setupRoutes() {
        // Route for starting the agent
        this.router.get("/start", (ctx: Context) => {
            this.workerManager.initWorkers(Object.values(Config.getInstance().bots));
            this.workerManager.startAllWorkers();

            ctx.response.body = {
                status: "success",
                message: "Agent task started"
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

    /**
     * Start the HTTP server using Oak
     */
    public async start() {
        console.log(`Server starting on ${this.hostname}:${this.port}`);

        await this.app.listen({
            hostname: this.hostname,
            port: this.port
        });
    }
}

export default Server;
