import { BotConfig } from "@/config.ts";
import { MCManager } from "./mc.ts";
import { Bot } from "mineflayer";
import { WorkerMessageType } from "@/worker/manager.ts";
import { GameSentMessage } from "@/game/index.ts";

const workerContext = self;

/**
 * Agent class for Minecraft bot
 */
export class Agent {
    private botConfig: BotConfig;
    private mcManager: MCManager;
    private bot: Bot | null = null;

    /**
     * Create a new Agent instance
     * @param botConfig The bot configuration
     */
    constructor(botConfig: BotConfig) {
        this.botConfig = botConfig;
        this.mcManager = MCManager.getInstance();
    }

    public async start(): Promise<void> {
        const botName = this.botConfig.name;

        this.bot = await this.mcManager.initBot(botName);
    }

    public stop() {
        this.bot?.end();
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
        workerContext.postMessage({
            type: WorkerMessageType.SEND,
            data: {
                type,
                data,
            },
        });
    }
}
