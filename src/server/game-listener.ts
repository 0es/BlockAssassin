import { GameService } from "./game.ts";
import { logger } from "@/utils/logger.ts";

declare module "./game.ts" {
    interface GameService {
        handleBotsInit(message: any): Promise<void>;
    }
}

// Handle botsInit message
GameService.prototype.handleBotsInit = async function (message) {
    try {
        if (!message.data || !Array.isArray(message.data)) {
            logger.error("Game Service: Invalid botsInit message format - missing data array");
            return;
        }

        logger.info(`Game Service: Initializing bots (${message.data.length} bots)`);

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
        logger.info(`Game Service: Cleaned bots directory: ${this.botsConfigPath}`);

        // Create new bot configuration files
        for (const botConfig of message.data) {
            if (!botConfig.name) {
                logger.warn("Game Service: Bot configuration missing name, skipping");
                continue;
            }

            const botFilePath = `${this.botsConfigPath}/${botConfig.name}.json`;

            try {
                await Deno.writeTextFile(botFilePath, JSON.stringify(botConfig, null, 2));
                logger.info(`Game Service: Created bot configuration for bot ${botConfig.name}`);
            } catch (error) {
                logger.error(`Game Service: Failed to write bot configuration file: ${botFilePath}`, error as Error);
            }
        }

        logger.info(`Game Service: Bot initialization completed (${message.data.length} bots)`);
    } catch (error) {
        logger.error("Game Service: Error handling botsInit message", error as Error);
    }
};
