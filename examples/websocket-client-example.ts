/**
 * WebSocket Client Example
 *
 * 这个示例演示如何使用WebSocket客户端连接到服务器。
 */
import { WebSocketClient } from "@/server/websocket.ts";
import { logger } from "@/utils/logger.ts";

// 设置认证令牌（通常通过认证流程获取）
const authToken =
    "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJibG9jay1hc3Nhc3Npbi1zZXJ2ZXIiLCJzdWIiOiI0MTVlOGM4ZC0yZDNlLTQwZmQtOGE2MC1jNTNkYjFmMTZiN2QiLCJleHAiOjE3NDMxMzI1MTIsInJvbGUiOiJhZG1pbiIsInR5cGUiOiJ3c19hY2Nlc3MifQ.kUNhkK1ZpfosH8NfUCCPKSkWXcSovOzS39PhhuKASIUnWEf_DCTG73Bh4mbw9aAGoGOJH8mfyobrUoWiSgHqsQ";

// 启动示例
async function startExample() {
    try {
        // 获取WebSocket客户端实例
        const client = WebSocketClient.getInstance();

        // 设置认证令牌
        client.setAuthToken(authToken);

        // 注册事件处理器
        client.onConnect(() => {
            logger.info("连接并认证成功！");

            // 向服务器发送消息
            sendTestMessage(client);

            // 示例：获取客户端信息
            const clientId = client.getClientId();
            logger.info(`当前客户端ID: ${clientId}`);

            // 示例：检查连接状态
            const connectionState = client.getState();
            logger.info(`当前连接状态: ${connectionState}`);
        });

        client.onMessage((message) => {
            logger.info(`收到消息: ${JSON.stringify(message)}`);

            // 示例：根据消息类型处理不同消息
            if (message.type === "gameState") {
                logger.info("处理游戏状态更新");
                // updateGameState(message.data);
            } else if (message.type === "command") {
                logger.info("处理服务器命令");
                // handleCommand(message.data);
            }
        });

        client.onError((error) => {
            logger.error(`WebSocket错误: ${error.message}`);
        });

        client.onClose((code, reason) => {
            logger.info(`WebSocket关闭: ${code} - ${reason}`);
        });

        // 连接到服务器
        const success = await client.connect();
        if (!success) {
            logger.error("无法启动与服务器的连接");
            return;
        }

        logger.info("连接已启动，等待认证...");
    } catch (error) {
        logger.error("WebSocket示例中出现错误", error as Error);
    }
}

// 向服务器发送测试消息
async function sendTestMessage(client: WebSocketClient) {
    try {
        // 等待确保连接稳定
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!client.isAuthenticated()) {
            logger.error("无法发送消息：未认证");
            return;
        }

        // 示例：发送简单消息
        const simpleMessage = {
            type: "test",
            data: {
                message: "来自BlockAssassin客户端的问候！",
                timestamp: new Date().toISOString(),
            },
        };

        logger.info(`发送消息: ${JSON.stringify(simpleMessage)}`);
        await client.send(simpleMessage);
        logger.info("消息发送成功");

        // 示例：发送游戏命令
        setTimeout(async () => {
            const gameCommand = {
                type: "command",
                data: {
                    action: "move",
                    direction: "forward",
                    blocks: 2,
                },
            };

            logger.info(`发送游戏命令: ${JSON.stringify(gameCommand)}`);
            await client.send(gameCommand);
            logger.info("游戏命令发送成功");
        }, 2000);

        // 示例：请求游戏状态
        setTimeout(async () => {
            const stateRequest = {
                type: "getState",
                data: {
                    requestId: crypto.randomUUID(),
                    components: ["inventory", "position", "health"],
                },
            };

            logger.info(`请求游戏状态: ${JSON.stringify(stateRequest)}`);
            await client.send(stateRequest);
            logger.info("状态请求发送成功");
        }, 4000);
    } catch (error) {
        logger.error("发送测试消息失败", error as Error);
    }
}

// 优雅关闭连接的示例
function shutdownExample(client: WebSocketClient) {
    logger.info("正在关闭WebSocket连接...");
    client.disconnect("用户请求关闭");
    logger.info("WebSocket连接已关闭");
}

// 运行示例
if (import.meta.main) {
    logger.info("启动WebSocket客户端示例");
    startExample();

    // 保持进程运行
    await new Promise(() => {});
}

/**
 * 使用方法示例:
 *
 * // 导入WebSocketClient
 * import { WebSocketClient } from "@/server/websocket.ts";
 *
 * // 获取单例实例
 * const wsClient = WebSocketClient.getInstance();
 *
 * // 设置认证令牌（从认证流程获取）
 * wsClient.setAuthToken("your_auth_token");
 *
 * // 注册消息处理器
 * wsClient.onMessage((message) => {
 *     console.log("收到消息:", message);
 *
 *     // 处理不同类型的消息
 *     if (message.type === "gameState") {
 *         updateGameState(message.data);
 *     }
 * });
 *
 * // 注册连接事件
 * wsClient.onConnect(() => {
 *     console.log("已连接到服务器！");
 *
 *     // 发送初始数据请求
 *     wsClient.send({
 *         type: "getGameState",
 *         data: { level: 1 }
 *     });
 * });
 *
 * // 注册错误处理
 * wsClient.onError((error) => {
 *     console.error("WebSocket错误:", error.message);
 * });
 *
 * // 注册关闭事件
 * wsClient.onClose((code, reason) => {
 *     console.log(`连接关闭: ${code} - ${reason}`);
 * });
 *
 * // 连接到服务器
 * await wsClient.connect();
 *
 * // 检查认证状态
 * if (wsClient.isAuthenticated()) {
 *     // 可以安全发送消息
 * }
 *
 * // 关闭连接
 * wsClient.disconnect("应用关闭");
 */
