// Daily FRED update inside the app process. Started once from instrumentation.ts.
// Runs at INGEST_HOUR_UTC (default 15:00 UTC, after the US morning data releases reach FRED),
// and also at startup when the last successful update is more than 20 hours old.
import { backupDatabase, getLastSuccessfulRun } from "./db";
import { runIngest } from "./ingest";

const HOUR_UTC = Number(process.env.INGEST_HOUR_UTC ?? 15);
const STALE_MS = 20 * 60 * 60 * 1000;

const g = globalThis as typeof globalThis & { __economySchedulerStarted?: boolean };

export function msUntilNextRun(now: Date, hourUtc: number): number {
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0));
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
}

async function update(reason: string) {
    try {
        const result = await runIngest();
        console.log(
            `[ingest] ${reason}: ${result.status}, ${result.seriesOk} ok, ${result.seriesFailed} failed in ${result.ms} ms` +
                (result.errors.length ? ` (${result.errors.join("; ")})` : ""),
        );
        if (result.status === "ok" || result.status === "partial") {
            console.log(`[backup] wrote ${await backupDatabase()}`);
        }
    } catch (err) {
        console.error(`[ingest] ${reason} crashed:`, err);
    }
}

function scheduleNext() {
    const ms = msUntilNextRun(new Date(), HOUR_UTC);
    console.log(`[ingest] next daily update at ${new Date(Date.now() + ms).toISOString()}`);
    setTimeout(async () => {
        await update("daily");
        scheduleNext();
    }, ms);
}

export function startScheduler() {
    if (g.__economySchedulerStarted) return;
    g.__economySchedulerStarted = true;

    if (!process.env.FRED_API_KEY) {
        console.warn("[ingest] FRED_API_KEY is not set, so daily updates are off");
        return;
    }

    setTimeout(async () => {
        const last = getLastSuccessfulRun();
        const age = last?.finishedAt ? Date.now() - Date.parse(last.finishedAt) : Infinity;
        if (age > STALE_MS) await update("startup");
        scheduleNext();
    }, 5_000);
}
