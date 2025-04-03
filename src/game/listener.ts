import { GameService } from "./index.ts";
import { logger } from "@/utils/logger.ts";

const gameLogger = logger.withPrefix("Game Service");

declare module "./index.ts" {
    interface GameService {
        handleBotsInit(bots: { name: string }[]): Promise<void>;
    }
}

// Handle botsInit message
GameService.prototype.handleBotsInit = async function (bots) {
    try {
        if (!bots || !Array.isArray(bots)) {
            gameLogger.error("Invalid botsInit message format - missing data array");
            return;
        }

        gameLogger.info(`Initializing bots (${bots.length} bots)`);

        // Ensure bots directory exists
        try {
            await Deno.mkdir(this.botsConfigPath, { recursive: true });
        } catch (error) {
            if (!(error instanceof Deno.errors.AlreadyExists)) {
                throw error;
            }
        }

        // Clean existing bot configurations by removing all files in directory
        for await (const entry of Deno.readDir(this.botsConfigPath)) {
            if (entry.isFile) {
                await Deno.remove(`${this.botsConfigPath}/${entry.name}`);
            }
        }
        gameLogger.info(`Cleaned bots directory: ${this.botsConfigPath}`);

        // Create new bot configuration files
        for (const botConfig of bots) {
            if (!botConfig.name) {
                gameLogger.warn("Bot configuration missing name, skipping");
                continue;
            }

            const botFilePath = `${this.botsConfigPath}/${botConfig.name}.json`;

            try {
                await Deno.writeTextFile(botFilePath, JSON.stringify(botConfig, null, 2));
                gameLogger.info(`Created bot configuration for bot ${botConfig.name}`);
            } catch (error) {
                gameLogger.error(`Failed to write bot configuration file: ${botFilePath}`, error as Error);
            }
        }

        gameLogger.info(`Bot initialization completed (${bots.length} bots)`);
    } catch (error) {
        gameLogger.error("Error handling botsInit message", error as Error);
    }
};
