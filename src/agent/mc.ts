import { Bot, createBot } from "npm:mineflayer";
import minecraftData from "minecraft-data";
import Config from "@/config.ts";

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
            this.bot.once('spawn', () => {
                this.mcData = minecraftData(this.bot!.version);

                resolve(this.bot!);
            });

            // Add basic error handling
            this.bot.on('error', (err: Error) => {
                console.error('Bot error:', err);
                reject(err);
            });

            this.bot.on('kicked', (reason: string) => {
                console.log('Bot was kicked from the server for:', reason);
            });

            this.bot.on('end', () => {
                console.log('Bot connection ended');
                this.bot = null;
            });
        });
    }

    /**
     * Get the current bot instance
     * @returns The current bot instance or null if not initialized
     */
    public getBot(): Bot | null {
        return this.bot;
    }

    /**
     * Get the Minecraft data
     * @returns The Minecraft data or null if not initialized
     */
    public getMcData(): minecraftData.IndexedData | null {
        return this.mcData;
    }
}

export default MCManager.getInstance();
