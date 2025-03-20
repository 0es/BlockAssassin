import { Settings } from "@/config.ts";
import { WorkerManager } from "@/worker/manager.ts";

/**
 * Server class for handling HTTP requests
 */
class Server {
    private hostname: string;
    private port: number;

    /**
     * Constructor for the Server class
     * @param port - Port number to listen on
     * @param hostname - Hostname to bind to
     */
    constructor(settings: Settings, workerManager: WorkerManager) {
        this.hostname = settings.host;
        this.port = settings.port;
    }

    /**
     * Start the HTTP server
     */
    public async start() {
        console.log(`Server starting on ${this.hostname}:${this.port}`);

        await Deno.serve(
            { hostname: this.hostname, port: this.port },
            (request: Request) => {
                return new Response("Minecraft AI Agent Server", {
                    status: 200,
                    headers: { "Content-Type": "text/plain" },
                });
            },
        );
    }
}

export default Server;
