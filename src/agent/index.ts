import { BotConfig } from "@/config.ts";

/**
 * Agent class for Minecraft bot
 */
export class Agent {
    private botConfig: BotConfig;

    /**
     * Create a new Agent instance
     * @param bot The Minecraft bot instance
     */
    constructor(botConfig: BotConfig) {
        this.botConfig = botConfig;
    }
}
