// Next.js calls register() once when the server starts. It starts the daily FRED update.
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startScheduler } = await import("./lib/scheduler");
        startScheduler();
    }
}
