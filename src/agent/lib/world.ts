import mcManager from "../mc.ts";

/**
 * World information utilities for the Minecraft bot
 * This module provides functions to interact with the Minecraft world and get information about the bot's surroundings.
 * All functions in this module should be called after the bot is connected to the server.
 */

/**
 * Gets the biome name at the bot's current position
 * @returns {string} The name of the biome where the bot is currently located
 * @throws {Error} If the bot or mcData is not initialized
 */
export function getBotBiomeName(): string {
    const bot = mcManager.getBot();
    const mcData = mcManager.getMcData();

    const biomeId = bot.world.getBiome(bot.entity.position);
    return mcData.biomes[biomeId].name;
}

/**
 * Gets a list of all players within a specified distance from the bot
 * @param {number} maxDistance - Maximum distance to search for players (default: 16 blocks)
 * @returns {Array<Entity>} Array of player entities, sorted by distance from closest to farthest
 * @throws {Error} If the bot is not initialized
 */
export function getNearbyPlayers(maxDistance = 16) {
    const bot = mcManager.getBot();
    const players = [];

    for (const entity of Object.values(bot.entities)) {
        const distance = entity.position.distanceTo(bot.entity.position);
        if (distance > maxDistance) continue;
        if (entity.type == "player" && entity.username != bot.username) {
            players.push({ entity: entity, distance: distance });
        }
    }
    players.sort((a, b) => a.distance - b.distance);

    return players.map((player) => player.entity);
}

/**
 * Get a list of the nearest blocks of the given types.
 */
export function getNearestBlocks(block_types: string[] | undefined, distance = 64, count = 10000) {
    const bot = mcManager.getBot();
    let block_ids: number[] = [];

    if (!block_types) {
        block_ids = mcManager.getAllBlockIds(["air"]);
    } else {
        for (const block_type of block_types) {
            const block_id = mcManager.getBlockId(block_type);
            block_id !== null && block_ids.push(block_id);
        }
    }

    const positions = bot.findBlocks({ matching: block_ids, maxDistance: distance, count: count });
    const blocks = [];
    for (let i = 0; i < positions.length; i++) {
        const block = bot.blockAt(positions[i]);
        const distance = positions[i].distanceTo(bot.entity.position);

        if (
            block &&
            (["chest", "trapped_chest", "furnace", "wheat", "carrots", "potatoes", "beetroots", "melon", "pumpkin"].includes(block.name) ||
                bot.canSeeBlock(block))
        ) {
            blocks.push({ block: block, distance: distance });
        }
    }
    blocks.sort((a, b) => a.distance - b.distance);

    return blocks.map((b) => b.block);
}

export function getNearbyEntities(maxDistance = 16) {
    const bot = mcManager.getBot();
    const entities = [];

    for (const entity of Object.values(bot.entities)) {
        const distance = entity.position.distanceTo(bot.entity.position);

        if (distance > maxDistance) continue;
        entities.push({ entity: entity, distance: distance });
    }
    entities.sort((a, b) => a.distance - b.distance);

    return entities.map((e) => e.entity);
}

/**
 * Gets a list of unique player names within the default detection range
 * @returns {string[]} Array of unique player usernames nearby
 * @throws {Error} If the bot is not initialized
 */
export function getNearbyPlayerNames() {
    const players = getNearbyPlayers();
    return [...new Set(players.map((player) => player.username).filter((name): name is string => name !== undefined))];
}

/**
 * Gets a list of unique block types within the specified distance
 */
export function getNearbyBlockTypes(distance = 16) {
    const blocks = getNearestBlocks(undefined, distance);
    return [...new Set(blocks.map((b) => b.name))];
}

/**
 * Get a list of all nearby mob types.
 */
export function getNearbyEntityTypes() {
    const mobs = getNearbyEntities();
    return [...new Set(mobs.map((mob) => mob.name).filter((name): name is string => name !== undefined))];
}
