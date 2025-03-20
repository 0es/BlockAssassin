import { parse } from "npm:jsonc-parser";
import { join } from "@std/path";

/**
 * Bot configuration interface
 */
export interface BotConfig {
    name: string;
    identity: string;
    prompt: string;
}

/**
 * Project settings interface
 */
export interface Settings {
    host: string;
    port: number;
    [key: string]: unknown;
}

/**
 * Game configuration interface
 */
export interface GameConfig {
    host: string;
    port: number;
    player_username: string;
    [key: string]: unknown;
}

/**
 * Config class for managing application configuration
 */
export class Config {
    private static instance: Config;
    private configDir: string;

    settings: Settings = {
        host: "localhost",
        port: 10101,
    };

    bots: Record<string, BotConfig> = {};

    game: GameConfig = {
        host: "localhost",
        port: 25565,
        player_username: "Player",
    };

    /**
     * Get singleton instance
     */
    public static getInstance(): Config {
        if (!Config.instance) {
            Config.instance = new Config();
        }
        return Config.instance;
    }

    /**
     * Private constructor for singleton pattern
     */
    private constructor(configDir: string = join(Deno.cwd(), "config")) {
        this.configDir = configDir;
        this.loadConfig();

        console.log("Settings loaded:", this.settings);
        console.log("Bots loaded:", Object.keys(this.bots));
        console.log("Game config loaded:", this.game);
    }

    /**
     * Load all configuration
     */
    private loadConfig(): void {
        this.loadSettings();
        this.loadBots();
        this.loadGameConfig();
    }

    /**
     * Parse a config file content as JSONC or JSON
     */
    private parseConfigFile<T>(content: string): T {
        try {
            return parse(content) as T;
        } catch (jsonError) {
            try {
                return JSON.parse(content) as T;
            } catch {
                throw jsonError;
            }
        }
    }

    /**
     * Load settings from settings.jsonc
     */
    private loadSettings(): void {
        const configPath = join(this.configDir, "settings.jsonc");

        try {
            if (!Deno.statSync(configPath).isFile) {
                console.warn("Settings file not found, using defaults");
                return;
            }

            const content = Deno.readTextFileSync(configPath);
            const parsedSettings = this.parseConfigFile<Settings>(content);
            this.settings = { ...this.settings, ...parsedSettings };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Error loading settings: ${errorMessage}`);
        }
    }

    /**
     * Load bot configurations from bots directory
     */
    private loadBots(): void {
        const botsDir = join(this.configDir, "bots");

        try {
            const dirExists = (() => {
                try {
                    return Deno.statSync(botsDir).isDirectory;
                } catch {
                    return false;
                }
            })();

            if (!dirExists) {
                console.warn("Bots directory not found");
                return;
            }

            for (const entry of Deno.readDirSync(botsDir)) {
                if (
                    entry.isFile &&
                    (entry.name.endsWith(".json") ||
                        entry.name.endsWith(".jsonc"))
                ) {
                    const botName = entry.name.replace(/\.(json|jsonc)$/, "");
                    const botPath = join(botsDir, entry.name);

                    try {
                        const content = Deno.readTextFileSync(botPath);
                        const botConfig = this.parseConfigFile<Omit<BotConfig, "name">>(content);

                        this.bots[botName] = {
                            name: botName,
                            ...botConfig,
                        };
                    } catch (error: unknown) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        console.error(
                            `Error loading bot config ${botName}: ${errorMessage}`,
                        );
                    }
                }
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Error loading bots directory: ${errorMessage}`);
        }
    }

    /**
     * Load game configuration from game.jsonc
     */
    private loadGameConfig(): void {
        const configPath = join(this.configDir, "game.jsonc");

        try {
            if (!Deno.statSync(configPath).isFile) {
                console.warn("Game config file not found, using defaults");
                return;
            }

            const content = Deno.readTextFileSync(configPath);
            const parsedConfig = this.parseConfigFile<GameConfig>(content);
            this.game = { ...this.game, ...parsedConfig };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Error loading game config: ${errorMessage}`);
        }
    }

    /**
     * Reload all configuration
     */
    public reload(): void {
        this.loadConfig();
    }

    /**
     * Get a specific bot configuration
     */
    public getBot(name: string): BotConfig | undefined {
        return this.bots[name];
    }

    /**
     * Get all bot names
     */
    public getBotNames(): string[] {
        return Object.keys(this.bots);
    }

    /**
     * Get game configuration
     */
    public getGameConfig(): GameConfig {
        return this.game;
    }
}

// Export default instance for easy import
export default Config.getInstance();
