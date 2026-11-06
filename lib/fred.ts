// Minimal FRED API client. Runs on the server only; the key never reaches the browser.
// Error messages name the endpoint and status but never the URL, which contains the key.
import type { Obs } from "./compute";
import type { SeriesMeta } from "./db";

const BASE = "https://api.stlouisfed.org/fred";

async function fredGet(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    const key = process.env.FRED_API_KEY;
    if (!key) throw new Error("FRED_API_KEY is not set");
    const url = `${BASE}/${path}?${new URLSearchParams({ ...params, api_key: key, file_type: "json" })}`;

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
            const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok || body.error_message) {
                throw new Error(`FRED ${path} returned ${res.status}${body.error_message ? `: ${body.error_message}` : ""}`);
            }
            return body;
        } catch (err) {
            lastError = err;
            if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 2000));
        }
    }
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(message.split(key).join("[key]"));
}

export async function fetchSeriesMeta(id: string): Promise<SeriesMeta> {
    const body = await fredGet("series", { series_id: id });
    const s = (body.seriess as Record<string, string>[] | undefined)?.[0];
    if (!s) throw new Error(`FRED series ${id} not found`);
    return {
        id: s.id,
        title: s.title,
        units: s.units,
        frequency: s.frequency_short ?? s.frequency,
        lastUpdated: s.last_updated ?? null,
    };
}

export async function fetchObservations(id: string, start: string): Promise<Obs[]> {
    const body = await fredGet("series/observations", { series_id: id, observation_start: start, limit: "100000" });
    const rows = (body.observations as { date: string; value: string }[] | undefined) ?? [];
    // FRED marks missing values with "."
    return rows.map((r) => ({ date: r.date, value: r.value === "." ? null : Number(r.value) }));
}
