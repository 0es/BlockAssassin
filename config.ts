import { parse } from "npm:jsonc-parser";
import { join } from "@std/path";

/**
 * Bot configuration interface
 */
interface BotConfig {
    name: string;
    identity: string;
    prompt: string;
}

/**
 * Project settings interface
 */
interface Settings {
    host: string;
    port: string;
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
        port: "10101",
    };

    bots: Record<string, BotConfig> = {};

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
    }

    /**
     * Load all configuration
     */
    private loadConfig(): void {
        this.loadSettings();
        this.loadBots();
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
            const parsedSettings = parse(content) as Settings;
            this.settings = { ...this.settings, ...parsedSettings };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : String(error);
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
                        let botConfig: Omit<BotConfig, "name">;

                        try {
                            botConfig = parse(content) as Omit<
                                BotConfig,
                                "name"
                            >;
                        } catch (jsonError) {
                            try {
                                botConfig = JSON.parse(content) as Omit<
                                    BotConfig,
                                    "name"
                                >;
                            } catch {
                                throw jsonError;
                            }
                        }

                        this.bots[botName] = {
                            name: botName,
                            ...botConfig,
                        };
                    } catch (error: unknown) {
                        const errorMessage = error instanceof Error
                            ? error.message
                            : String(error);
                        console.error(
                            `Error loading bot config ${botName}: ${errorMessage}`,
                        );
                    }
                }
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : String(error);
            console.error(`Error loading bots directory: ${errorMessage}`);
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
}

// Export default instance for easy import
export default Config.getInstance();
