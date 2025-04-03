/// <reference lib="deno.worker" />
import { BotConfig } from "@/config.ts";
import { Agent } from "@/agent/index.ts";
import { WorkerMessage, WorkerMessageType } from "./manager.ts";

/**
 * Agent Worker Thread
 * This runs in a separate Deno worker thread
 */

// Define self for Deno Worker context
const workerContext = self;

// Current agent instance
let agent: Agent | null = null;
let isRunning = false;

// Log helper function
function log(message: string): void {
    workerContext.postMessage({
        type: WorkerMessageType.LOG,
        data: message,
    } as WorkerMessage);
}

// Error helper function
function reportError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    workerContext.postMessage({
        type: WorkerMessageType.ERROR,
        data: errorMessage,
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

    try {
        await agent.start();
        isRunning = true;
        log("Agent started");

        // Start main processing loop
        runAgentLoop();
    } catch (error) {
        // Send a special START_FAILED message when startup fails
        const errorMessage = error instanceof Error ? error.message : String(error);
        workerContext.postMessage({
            type: WorkerMessageType.START_FAILED,
            data: errorMessage,
        } as WorkerMessage);

        log("Agent failed to start");
    }
}

// Stop agent processing
function stopAgent(): void {
    isRunning = false;
    log("Agent stopped");

    // Add safe shutdown logic
    try {
        if (agent) {
            agent.stop();
            log("Agent shutdown complete");
        }
    } catch (error) {
        reportError(error);
        log("Error during agent shutdown, but worker thread continues running");
    }
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
                task: task,
            },
        } as WorkerMessage);
    } catch (error) {
        reportError(error);
        // Send failure result instead of letting the error propagate
        workerContext.postMessage({
            type: WorkerMessageType.RESULT,
            data: {
                taskCompleted: false,
                error: error instanceof Error ? error.message : String(error),
                task: task,
            },
        } as WorkerMessage);
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
            await agent?.mainLoop();
        } catch (error) {
            reportError(error);
            // Don't break the loop on error, just continue
            // Add a small delay to prevent CPU spinning on repeated errors
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
}

// Handle messages from the main thread
workerContext.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;

    try {
        switch (message.type) {
            case WorkerMessageType.INIT:
                initAgent(message.data as BotConfig);
                break;
            case WorkerMessageType.START:
                await startAgent();
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
        log("Error in message handler, but worker continues running");
    }
});

// Add global error handlers
workerContext.addEventListener("error", (event: ErrorEvent) => {
    reportError(event.error || event.message);
    event.preventDefault(); // Prevent the error from bubbling up
    log("Uncaught error in worker thread, but continuing execution");
});

workerContext.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    reportError(event.reason || "Unhandled promise rejection");
    event.preventDefault(); // Prevent the rejection from bubbling up
    log("Unhandled promise rejection in worker thread, but continuing execution");
});

// Log worker startup
log("Worker thread started");
