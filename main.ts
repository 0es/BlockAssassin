import "@std/dotenv/load";
import Server from "@/server/index.ts";

const server = new Server();

await server.start();
