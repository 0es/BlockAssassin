import { Bot, createBot } from "mineflayer";
import minecraftData from "minecraft-data";
import Config from "@/config.ts";
import { logger } from "@/utils/logger.ts";
import * as world from "./lib/world.ts";

interface HUD {
    position: string;
    gamemode: string;
    health: string;
    hunger: string;
    biome: string;
    weather: string;
    timeOfDay: string;
    otherPlayers: string[];
    backpack: string[];
    hotbar: string[];
    offHand: string[];
    armor: string[];
    nearbyBlocks: string[];
    nearbyEntities: string[];
}

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
     * Generates a heads-up display (HUD) string with stats, inventory, nearby blocks, and nearby entities.
     * @returns An object containing the HUD data and formatted string, or null if bot is not initialized
     */
    public headsUpDisplay(): { newHUD: HUD; hudStr: string } | null {
        if (!this.bot) {
            return null;
        }

        // Inventory slot constants
        const ARMOR_SLOTS = {
            head: 5,
            torso: 6,
            legs: 7,
            feet: 8,
        };
        const MAIN_INVENTORY_START = 9;
        const MAIN_INVENTORY_END = 35;
        const HOTBAR_START = 36;
        const HOTBAR_END = 44;
        const OFF_HAND_SLOT = 45;

        // Initialize new HUD elements
        const newHUD: HUD = {
            position: `x: ${this.bot.entity.position.x.toFixed(2)}, y: ${this.bot.entity.position.y.toFixed(2)}, z: ${
                this.bot.entity.position.z.toFixed(2)
            }`,
            gamemode: this.bot.game.gameMode,
            health: `${Math.round(this.bot.health)} / 20`,
            hunger: `${Math.round(this.bot.food)} / 20`,
            biome: world.getBotBiomeName(),
            weather: this.bot.thunderState > 0 ? "Thunderstorm" : this.bot.isRaining ? "Rain" : "Clear",
            timeOfDay: this.bot.time.timeOfDay < 6000 ? "Morning" : this.bot.time.timeOfDay < 12000 ? "Afternoon" : "Night",
            otherPlayers: world.getNearbyPlayerNames(),
            backpack: [],
            hotbar: [],
            offHand: [],
            armor: [],
            nearbyBlocks: world.getNearbyBlockTypes(),
            nearbyEntities: world.getNearbyEntityTypes(),
        };

        // Populate inventory data
        for (let i = MAIN_INVENTORY_START; i <= MAIN_INVENTORY_END; i++) {
            const item = this.bot.inventory.slots[i];
            if (item) {
                newHUD.backpack.push(`${item.name}: ${item.count}`);
            }
        }

        for (let i = HOTBAR_START; i <= HOTBAR_END; i++) {
            const item = this.bot.inventory.slots[i];
            if (item) {
                newHUD.hotbar.push(`${item.name}: ${item.count}`);
            }
        }

        if (!this.bot.supportFeature("doesntHaveOffHandSlot")) {
            const offHandItem = this.bot.inventory.slots[OFF_HAND_SLOT];
            if (offHandItem) {
                newHUD.offHand.push(`${offHandItem.name}: ${offHandItem.count}`);
            } else {
                newHUD.offHand.push("empty");
            }
        }

        for (const [slotName, slotIndex] of Object.entries(ARMOR_SLOTS)) {
            const item = this.bot.inventory.slots[slotIndex];
            newHUD.armor.push(`${slotName}: ${item ? `${item.name}: ${item.count}` : "empty"}`);
        }

        // Build the HUD string sections
        const sections = [
            // Stats section
            [
                "STATS",
                `- Position: ${newHUD.position}`,
                `- Gamemode: ${newHUD.gamemode}`,
                `- Health: ${newHUD.health}`,
                `- Hunger: ${newHUD.hunger}`,
                `- Biome: ${newHUD.biome}`,
                `- Weather: ${newHUD.weather}`,
                `- Time: ${newHUD.timeOfDay}`,
                ...(newHUD.otherPlayers.length ? [`- Other Players: ${newHUD.otherPlayers.join(", ")}`] : []),
            ].join("\n"),

            // Inventory section
            [
                "INVENTORY",
                `Backpack:${newHUD.backpack.length ? `\n- ${newHUD.backpack.join("\n- ")}` : " none"}`,
                `Hotbar:${newHUD.hotbar.length ? `\n- ${newHUD.hotbar.join("\n- ")}` : " none"}`,
                `Off Hand Slot:${newHUD.offHand.length ? `\n- ${newHUD.offHand.join("\n- ")}` : " none"}`,
                `Armor Slots:${newHUD.armor.length ? `\n- ${newHUD.armor.join("\n- ")}` : " none"}`,
                ...(this.bot.game.gameMode === "creative" ? ["(You have infinite items in creative mode)"] : []),
            ].join("\n"),

            // Nearby blocks section
            `NEARBY_BLOCKS${newHUD.nearbyBlocks.length ? `\n- ${newHUD.nearbyBlocks.join("\n- ")}` : ": none"}`,

            // Nearby entities section
            `NEARBY_ENTITIES${newHUD.nearbyEntities.length ? `\n- mob: ${newHUD.nearbyEntities.join("\n- mob: ")}` : ": none"}`,
        ];

        return {
            newHUD,
            hudStr: sections.join("\n"),
        };
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
