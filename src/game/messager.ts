import { GameSentMessageType, GameService } from "./index.ts";
// import { logger } from "@/utils/logger.ts";

declare module "./index.ts" {
    interface GameService {
        handleBotHUDSync(bot: string, hudStr: string): Promise<void>;
    }
}

GameService.prototype.handleBotHUDSync = async function (bot, hudStr) {
    await this.wsClient.send({ type: GameSentMessageType.BOT_HUDSYNC, data: { bot, hudStr } });
};
