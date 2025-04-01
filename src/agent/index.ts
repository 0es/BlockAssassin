import { BotConfig } from "@/config.ts";
import mcManager, { MCManager } from "./mc.ts";
import { Bot } from "mineflayer";
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

    /**
     * Generates a heads-up display (HUD) string with stats, inventory, nearby blocks, and nearby entities.
     * @returns An object containing the HUD data and formatted string, or null if bot is not initialized
     */
    public headsUpDisplay(): { newHUD: HUD; hudString: string } | null {
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
            hudString: sections.join("\n"),
        };
    }
}
