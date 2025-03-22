import { BotConfig } from "@/config.ts";
import mcManager, { MCManager } from "./mc.ts";
import { Bot } from "mineflayer";

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
        this.mcManager = mcManager;
    }

    public async start(): Promise<void> {
        const botName = this.botConfig.name;

        this.bot = await this.mcManager.initBot(botName);
    }
}
