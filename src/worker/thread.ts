import { BotConfig } from "@/config.ts";
import { Agent } from "@/agent/index.ts";
import { WorkerMessage, WorkerMessageType } from "./manager.ts";

/**
 * Agent Worker Thread
 * This runs in a separate Deno worker thread
 */

// Define self for Deno Worker context
// deno-lint-ignore no-explicit-any
const workerContext = self as any;

// Current agent instance
let agent: Agent | null = null;
let isRunning = false;

// Log helper function
function log(message: string): void {
    workerContext.postMessage({
        type: WorkerMessageType.LOG,
        data: message
    } as WorkerMessage);
}

// Error helper function
function reportError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    workerContext.postMessage({
        type: WorkerMessageType.ERROR,
        data: errorMessage
    } as WorkerMessage);
}

// Initialize agent
function initAgent(config: BotConfig): void {
    try {
        agent = new Agent(config);
        log(`Agent initialized with config: ${config.name}`);
    } catch (error) {
        reportError(error);
    }
}

// Start agent processing
async function startAgent(): Promise<void> {
    if (!agent) {
        reportError("Cannot start: Agent not initialized");
        return;
    }

    await agent.start();

    isRunning = true;
    log("Agent started");

    // Start main processing loop
    runAgentLoop();
}

// Stop agent processing
function stopAgent(): void {
    isRunning = false;
    log("Agent stopped");
}

// Process a task
function processTask(task: unknown): void {
    if (!agent) {
        reportError("Cannot process task: Agent not initialized");
        return;
    }

    try {
        // Here you would implement task processing logic
        // For now, just log the task
        log(`Processing task: ${JSON.stringify(task)}`);

        // Send back a result
        workerContext.postMessage({
            type: WorkerMessageType.RESULT,
            data: {
                taskCompleted: true,
                task: task
            }
        } as WorkerMessage);
    } catch (error) {
        reportError(error);
    }
}

// Main agent loop
async function runAgentLoop(): Promise<void> {
    while (isRunning) {
        try {
            // Here you would implement the agent's continuous processing logic
            // For a Minecraft bot, this might involve observing the environment,
            // making decisions, and taking actions

            // For now, just sleep to avoid high CPU usage
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            reportError(error);
            // Don't break the loop on error, just continue
        }
    }
}

// Handle messages from the main thread
workerContext.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;

    try {
        switch (message.type) {
            case WorkerMessageType.INIT:
                initAgent(message.data as BotConfig);
                break;
            case WorkerMessageType.START:
                startAgent();
                break;
            case WorkerMessageType.STOP:
                stopAgent();
                break;
            case WorkerMessageType.TASK:
                processTask(message.data);
                break;
            default:
                log(`Unknown message type: ${message.type}`);
        }
    } catch (error) {
        reportError(error);
    }
});

// Log worker startup
log("Worker thread started");