/**
 * Server class for handling HTTP requests
 */
class Server {
    private port: number;
    private hostname: string;

    /**
     * Constructor for the Server class
     * @param port - Port number to listen on
     * @param hostname - Hostname to bind to
     */
    constructor(port: number = 10101, hostname: string = "localhost") {
        this.port = port;
        this.hostname = hostname;
    }

    /**
     * Start the HTTP server
     */
    public async start() {
        console.log(`Server starting on ${this.hostname}:${this.port}`);

        await Deno.serve(
            { port: this.port, hostname: this.hostname },
            (request: Request) => {
                return new Response("Minecraft AI Agent Server", {
                    status: 200,
                    headers: { "Content-Type": "text/plain" },
                });
            }
        );
    }
}

export default Server;
