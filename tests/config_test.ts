import { assertEquals, assertNotEquals, assertStrictEquals, assertExists } from "https://deno.land/std/assert/mod.ts";
import { assertSpyCalls, spy, resolvesNext, stub } from "https://deno.land/std/testing/mock.ts";
import { join } from "@std/path";
import { Config } from "@/config.ts";

// Mock path for testing
const TEST_CONFIG_DIR = join(Deno.cwd(), "test_config");
const TEST_SETTINGS_PATH = join(TEST_CONFIG_DIR, "settings.jsonc");
const TEST_BOTS_DIR = join(TEST_CONFIG_DIR, "bots");

// Test fixtures
const mockSettings = {
    host: "test-host",
    port: 8888,
    testOption: true
};

const mockBots = {
    "bot1": {
        identity: "Test Bot 1",
        prompt: "I am test bot 1"
    },
    "bot2": {
        identity: "Test Bot 2",
        prompt: "I am test bot 2"
    }
};

// Helper function to reset Config singleton
function resetConfigSingleton() {
    // @ts-ignore: Access private static instance for testing
    Config.instance = undefined;
}

// Create a fresh test environment
async function setupTestEnvironment() {
    // Clean up previous test environment if exists
    try {
        await Deno.remove(TEST_CONFIG_DIR, { recursive: true });
    } catch (_) {
        // Ignore errors if directory doesn't exist
    }

    // Create test directories
    await Deno.mkdir(TEST_CONFIG_DIR, { recursive: true });
    await Deno.mkdir(TEST_BOTS_DIR, { recursive: true });

    // Create test settings file
    await Deno.writeTextFile(
        TEST_SETTINGS_PATH,
        JSON.stringify(mockSettings, null, 2)
    );

    // Create test bot files
    for (const [botName, botConfig] of Object.entries(mockBots)) {
        await Deno.writeTextFile(
            join(TEST_BOTS_DIR, `${botName}.json`),
            JSON.stringify(botConfig, null, 2)
        );
    }
}

// Clean up test environment
async function cleanupTestEnvironment() {
    try {
        await Deno.remove(TEST_CONFIG_DIR, { recursive: true });
    } catch (_) {
        // Ignore errors if directory doesn't exist
    }
}

Deno.test("Config - Singleton Pattern", () => {
    resetConfigSingleton();

    // Get instance for the first time
    const instance1 = Config.getInstance();
    // Get instance for the second time
    const instance2 = Config.getInstance();

    // Both instances should be the same object
    assertStrictEquals(instance1, instance2);

    resetConfigSingleton();
});

Deno.test("Config - Settings Loading", async () => {
    resetConfigSingleton();

    await setupTestEnvironment();

    // Override the configDir for testing
    // @ts-ignore: Access private member for testing
    const config = new Config(TEST_CONFIG_DIR);

    // Verify settings loaded correctly
    assertEquals(config.settings.host, mockSettings.host);
    assertEquals(config.settings.port, mockSettings.port);
    assertEquals(config.settings.testOption, mockSettings.testOption);

    await cleanupTestEnvironment();
    resetConfigSingleton();
});

Deno.test("Config - Bot Loading", async () => {
    resetConfigSingleton();

    await setupTestEnvironment();

    // Override the configDir for testing
    // @ts-ignore: Access private constructor for testing
    const config = new Config(TEST_CONFIG_DIR);

    // Verify bots loaded correctly
    assertEquals(Object.keys(config.bots).length, 2);

    // Check bot1
    assertExists(config.bots.bot1);
    assertEquals(config.bots.bot1.name, "bot1");
    assertEquals(config.bots.bot1.identity, mockBots.bot1.identity);
    assertEquals(config.bots.bot1.prompt, mockBots.bot1.prompt);

    // Check bot2
    assertExists(config.bots.bot2);
    assertEquals(config.bots.bot2.name, "bot2");
    assertEquals(config.bots.bot2.identity, mockBots.bot2.identity);
    assertEquals(config.bots.bot2.prompt, mockBots.bot2.prompt);

    // Test getBot method
    assertEquals(config.getBot("bot1"), config.bots.bot1);
    assertEquals(config.getBot("nonexistent"), undefined);

    // Test getBotNames method
    assertEquals(config.getBotNames().sort(), ["bot1", "bot2"].sort());

    await cleanupTestEnvironment();
    resetConfigSingleton();
});

Deno.test("Config - Error Handling - Settings File Not Found", async () => {
    resetConfigSingleton();

    // Create empty test dir without settings file
    await Deno.mkdir(TEST_CONFIG_DIR, { recursive: true });

    // Mock console.warn to verify it's called
    const warnSpy = spy(console, "warn");

    try {
        // @ts-ignore: Access private constructor for testing
        const config = new Config(TEST_CONFIG_DIR);

        // Should use default settings
        assertEquals(config.settings.host, "localhost");
        assertEquals(config.settings.port, 10101);

        // Verify warning was logged
        assertSpyCalls(warnSpy, 1);
    } finally {
        warnSpy.restore();
        await cleanupTestEnvironment();
        resetConfigSingleton();
    }
});

Deno.test("Config - Error Handling - Bots Directory Not Found", async () => {
    resetConfigSingleton();

    // Create settings file but no bots directory
    await Deno.mkdir(TEST_CONFIG_DIR, { recursive: true });
    await Deno.writeTextFile(
        TEST_SETTINGS_PATH,
        JSON.stringify(mockSettings, null, 2)
    );

    // Mock console.warn to verify it's called
    const warnSpy = spy(console, "warn");

    try {
        // @ts-ignore: Access private constructor for testing
        const config = new Config(TEST_CONFIG_DIR);

        // Should have no bots
        assertEquals(Object.keys(config.bots).length, 0);

        // Verify warning was logged
        assertSpyCalls(warnSpy, 1);
    } finally {
        warnSpy.restore();
        await cleanupTestEnvironment();
        resetConfigSingleton();
    }
});

Deno.test("Config - Error Handling - Invalid Bot Configuration", async () => {
    resetConfigSingleton();

    await setupTestEnvironment();

    // Add an invalid bot file
    await Deno.writeTextFile(
        join(TEST_BOTS_DIR, "invalid.json"),
        "{ invalid json }"
    );

    try {
        // @ts-ignore: Access private constructor for testing
        const config = new Config(TEST_CONFIG_DIR);

        // Check valid bots were loaded correctly
        assertExists(config.bots.bot1);
        assertExists(config.bots.bot2);

        // If the implementation properly catches the error, the invalid bot should
        // either not be present or have correct name but incomplete data
        if (config.bots.invalid) {
            // If present, at least make sure it has a name property
            assertEquals(config.bots.invalid.name, "invalid");
        }
    } finally {
        await cleanupTestEnvironment();
        resetConfigSingleton();
    }
});

Deno.test("Config - Reload Method", async () => {
    resetConfigSingleton();

    await setupTestEnvironment();

    // @ts-ignore: Access private constructor for testing
    const config = new Config(TEST_CONFIG_DIR);

    // Initial state
    assertEquals(Object.keys(config.bots).length, 2);

    // Add a new bot
    await Deno.writeTextFile(
        join(TEST_BOTS_DIR, "bot3.json"),
        JSON.stringify({
            identity: "Test Bot 3",
            prompt: "I am test bot 3"
        }, null, 2)
    );

    // Reload config
    config.reload();

    // Should have the new bot
    assertEquals(Object.keys(config.bots).length, 3);
    assertExists(config.bots.bot3);
    assertEquals(config.bots.bot3.name, "bot3");

    await cleanupTestEnvironment();
    resetConfigSingleton();
});