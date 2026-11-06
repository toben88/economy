// Pulls every series from FRED into SQLite. Each series is saved in its own transaction,
// so one failure leaves the others updated and the previous data for the failed one intact.
import { finishRun, saveSeries, startRun } from "./db";
import { fetchObservations, fetchSeriesMeta } from "./fred";
import { FRED_SERIES, OBS_START } from "./indicators";

export type IngestResult = {
    status: "ok" | "partial" | "failed" | "skipped";
    seriesOk: number;
    seriesFailed: number;
    errors: string[];
    ms: number;
};

const g = globalThis as typeof globalThis & { __economyIngestRunning?: boolean };

export async function runIngest(): Promise<IngestResult> {
    if (g.__economyIngestRunning) return { status: "skipped", seriesOk: 0, seriesFailed: 0, errors: ["already running"], ms: 0 };
    g.__economyIngestRunning = true;
    const started = Date.now();
    const runId = startRun();
    let seriesOk = 0;
    const errors: string[] = [];

    try {
        for (const id of FRED_SERIES) {
            try {
                const [meta, obs] = await Promise.all([fetchSeriesMeta(id), fetchObservations(id, OBS_START)]);
                saveSeries(meta, obs);
                seriesOk++;
            } catch (err) {
                errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
            }
            // Stay far below FRED's limit of about 120 requests a minute
            await new Promise((r) => setTimeout(r, 300));
        }
    } finally {
        g.__economyIngestRunning = false;
    }

    const seriesFailed = errors.length;
    const status = seriesFailed === 0 ? "ok" : seriesOk === 0 ? "failed" : "partial";
    finishRun(runId, { status, seriesOk, seriesFailed, message: errors.length ? errors.join("; ").slice(0, 2000) : null });
    return { status, seriesOk, seriesFailed, errors, ms: Date.now() - started };
}
