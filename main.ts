import "@std/dotenv/load";
import config from "@/config.ts";
import Server from "@/server/index.ts";
import { WorkerManager } from "@/worker/manager.ts";

const workerManager = new WorkerManager();
const server = new Server(config.settings, workerManager);

await server.start();
