import "@std/dotenv/load";
import Server from "./src/server/index.ts";

const server = new Server();

server.start();
