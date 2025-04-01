import { GameService } from "./game.ts";
import { logger } from "@/utils/logger.ts";

declare module "./game.ts" {
    interface GameService {
        // handleBotHUDSync(bot: string, hudStr: string): void;
    }
}

// GameService.prototype.handleBotHUDSync = function (bot, hudStr) {
//     this.sendMessage("botHUDSync", { bot, hudStr });
// };
