import { Bot, createBot } from "mineflayer";
import minecraftData from "minecraft-data";
import Config from "@/config.ts";
import { logger } from "@/utils/logger.ts";

/**
 * MCManager class for controlling agent access to Minecraft game features
 */
export class MCManager {
    private static instance: MCManager | null = null;
    private bot: Bot | null = null;
    private mcData: minecraftData.IndexedData | null = null;

    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor() {}

    /**
     * Get the singleton instance of MCManager
     * @returns The MCManager instance
     */
    public static getInstance(): MCManager {
        if (!MCManager.instance) {
            MCManager.instance = new MCManager();
        }
        return MCManager.instance;
    }

    /**
     * Initialize the Minecraft bot
     * @param options Connection options for the Minecraft server
     * @returns The initialized bot instance
     */
    public initBot(name: string): Promise<Bot> {
        return new Promise((resolve, reject) => {
            const config = Config.getGameConfig();

            this.bot = createBot({
                username: name,
                host: config.host,
                port: config.port,
            }) as Bot;

            // Wait for spawn event to initialize minecraft-data
            this.bot.once("spawn", () => {
                this.mcData = minecraftData(this.bot!.version);

                resolve(this.bot!);
            });

            // Add basic error handling
            this.bot.on("error", (err: Error) => {
                logger.error("Bot error:", err);
                reject(err);
            });

            this.bot.on("kicked", (reason: string) => {
                logger.info("Bot was kicked from the server for: " + reason);
            });

            this.bot.on("end", () => {
                logger.info("Bot connection ended");
                this.bot = null;
            });
        });
    }

    /**
     * Check if the bot and mcData are initialized
     * @throws Error if bot or mcData is not initialized
     */
    private checkInitialized(): void {
        if (!this.bot || !this.mcData) {
            throw new Error("Bot not initialized. Call initBot() first.");
        }
    }

    /**
     * Get the current bot instance
     * @returns The current bot instance
     * @throws Error if bot is not initialized
     */
    public getBot(): Bot {
        this.checkInitialized();
        return this.bot as Bot;
    }

    /**
     * Get the Minecraft data
     * @returns The Minecraft data
     * @throws Error if mcData is not initialized
     */
    public getMcData(): minecraftData.IndexedData {
        this.checkInitialized();
        return this.mcData as minecraftData.IndexedData;
    }

    public getBlockId(blockName: string) {
        const block = this.getMcData().blocksByName[blockName];
        return block ? block.id : null;
    }

    /**
     * Get all Minecraft blocks, with optional filtering
     * @param ignore Array of block names to exclude from results
     * @returns Array of block objects
     */
    public getAllBlocks(ignore: string[] = []) {
        const blocks = this.getMcData().blocks;
        return Object.values(blocks).filter((block) => !ignore.includes(block.name));
    }

    /**
     * Get all Minecraft block IDs, with optional filtering
     * @param ignore Array of block names to exclude from results
     * @returns Array of block IDs
     */
    public getAllBlockIds(ignore: string[] = []) {
        return this.getAllBlocks(ignore).map((block) => block.id);
    }

    /**
     * Get all biomes from the Minecraft data
     * @returns All biome objects
     */
    public getAllBiomes() {
        return this.getMcData().biomes;
    }
}

export default MCManager.getInstance();
