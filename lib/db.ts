// The only module that talks to SQLite. Everything else goes through these functions.
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { MIGRATIONS } from "./migrations";
import * as schema from "./schema";
import type { Obs } from "./compute";

export const DB_PATH = process.env.DATABASE_PATH ?? join(process.cwd(), "data", "economy.db");
const BACKUPS_KEPT = 7;

type Db = BetterSQLite3Database<typeof schema>;
type Handles = { sqlite: Database.Database; db: Db };

// One connection per process, kept on globalThis so dev-mode reloads don't open more.
const g = globalThis as typeof globalThis & { __economyDb?: Handles };

function open(): Handles {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    const sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
    migrate(sqlite);
    return { sqlite, db: drizzle(sqlite, { schema }) };
}

function migrate(sqlite: Database.Database) {
    sqlite.exec(
        "CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT",
    );
    const applied = new Set(
        (sqlite.prepare("SELECT id FROM schema_migrations").all() as { id: number }[]).map((r) => r.id),
    );
    for (const m of MIGRATIONS) {
        if (applied.has(m.id)) continue;
        sqlite.transaction(() => {
            sqlite.exec(m.sql);
            sqlite
                .prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)")
                .run(m.id, m.name, new Date().toISOString());
        })();
        console.log(`[db] applied migration ${m.id} (${m.name})`);
    }
}

function handles(): Handles {
    if (!g.__economyDb) g.__economyDb = open();
    return g.__economyDb;
}

export const getDb = () => handles().db;

// ---- Reads -------------------------------------------------------------------------------------

export function getObservations(seriesId: string): Obs[] {
    return getDb()
        .select({ date: schema.observations.date, value: schema.observations.value })
        .from(schema.observations)
        .where(eq(schema.observations.seriesId, seriesId))
        .orderBy(asc(schema.observations.date))
        .all();
}

export function getLastSuccessfulRun() {
    return getDb()
        .select()
        .from(schema.ingestRuns)
        .where(inArray(schema.ingestRuns.status, ["ok", "partial"]))
        .orderBy(desc(schema.ingestRuns.id))
        .limit(1)
        .get();
}

export function getLastRun() {
    return getDb().select().from(schema.ingestRuns).orderBy(desc(schema.ingestRuns.id)).limit(1).get();
}

// ---- Writes ------------------------------------------------------------------------------------

export type SeriesMeta = { id: string; title: string; units: string; frequency: string; lastUpdated: string | null };

const CHUNK = 500;

/** Saves one series and all its observations in a single transaction (all or nothing). */
export function saveSeries(meta: SeriesMeta, obs: Obs[]) {
    const fetchedAt = new Date().toISOString();
    getDb().transaction((tx) => {
        const row = {
            id: meta.id,
            title: meta.title,
            units: meta.units,
            frequency: meta.frequency,
            fredLastUpdated: meta.lastUpdated,
            fetchedAt,
        };
        const { id: _id, ...changes } = row;
        tx.insert(schema.series).values(row).onConflictDoUpdate({ target: schema.series.id, set: changes }).run();
        for (let i = 0; i < obs.length; i += CHUNK) {
            tx.insert(schema.observations)
                .values(obs.slice(i, i + CHUNK).map((o) => ({ seriesId: meta.id, date: o.date, value: o.value })))
                .onConflictDoUpdate({
                    target: [schema.observations.seriesId, schema.observations.date],
                    set: { value: sql`excluded.value` },
                })
                .run();
        }
    });
}

export function startRun(): number {
    const row = getDb()
        .insert(schema.ingestRuns)
        .values({ startedAt: new Date().toISOString(), status: "running" })
        .returning({ id: schema.ingestRuns.id })
        .get();
    return row.id;
}

export function finishRun(
    id: number,
    result: { status: "ok" | "partial" | "failed"; seriesOk: number; seriesFailed: number; message: string | null },
) {
    getDb()
        .update(schema.ingestRuns)
        .set({ ...result, finishedAt: new Date().toISOString() })
        .where(eq(schema.ingestRuns.id, id))
        .run();
}

// ---- Backups -----------------------------------------------------------------------------------

/** Writes a consistent copy to <db folder>/backups/economy-YYYY-MM-DD.db and keeps the newest seven. */
export async function backupDatabase(): Promise<string> {
    const dir = join(dirname(DB_PATH), "backups");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `economy-${new Date().toISOString().slice(0, 10)}.db`);
    await handles().sqlite.backup(file);
    const old = readdirSync(dir)
        .filter((f) => /^economy-\d{4}-\d{2}-\d{2}\.db$/.test(f))
        .sort()
        .slice(0, -BACKUPS_KEPT);
    for (const f of old) rmSync(join(dir, f));
    return file;
}
