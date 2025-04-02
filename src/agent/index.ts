import { BotConfig } from "@/config.ts";
import mcManager from "./mc.ts";
import { Bot } from "mineflayer";
import { WorkerMessageType } from "@/worker/manager.ts";
import { GameSentMessage } from "@/game/index.ts";

/**
 * Agent class for Minecraft bot
 */
export class Agent {
    private workerContext;
    private botConfig: BotConfig;
    private mcManager = mcManager;
    private bot: Bot | null = null;

    /**
     * Create a new Agent instance
     * @param botConfig The bot configuration
     */
    constructor(workerContext: Window & typeof globalThis, botConfig: BotConfig) {
        this.workerContext = workerContext;
        this.botConfig = botConfig;
    }

    public async start(): Promise<void> {
        const botName = this.botConfig.name;

        this.bot = await this.mcManager.initBot(botName);
    }

    public async mainLoop() {
        this.syncInfo();

        await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    private syncInfo() {
        this.syncHUDInfo();
    }

    private syncHUDInfo() {
        const hudInfo = this.mcManager.headsUpDisplay();

        hudInfo && this.sendMessage("botHUDSync", {
            hudStr: hudInfo.hudStr,
        });
    }

    public sendMessage(type: string, data: GameSentMessage["data"]) {
        this.workerContext.postMessage({
            type: WorkerMessageType.SEND,
            data: {
                type,
                data,
            },
        });
    }
}
