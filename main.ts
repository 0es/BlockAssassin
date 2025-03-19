import "@std/dotenv/load";
import config from "@/config.ts";
import Server from "@/src/server/index.ts";

const server = new Server(config.settings);

await server.start();
