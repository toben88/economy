import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Point the database at a throwaway folder before lib/db is loaded
const dir = mkdtempSync(join(tmpdir(), "economy-db-test-"));
process.env.DATABASE_PATH = join(dir, "test.db");

let db: typeof import("@/lib/db");

beforeAll(async () => {
    db = await import("@/lib/db");
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const meta = { id: "UNRATE", title: "Unemployment Rate", units: "Percent", frequency: "M", lastUpdated: "2026-11-06" };

describe("database", () => {
    it("saves a series and reads it back in date order", () => {
        db.saveSeries(meta, [
            { date: "2026-10-01", value: 4.1 },
            { date: "2026-09-01", value: 4.2 },
            { date: "2026-08-01", value: null },
        ]);
        expect(db.getObservations("UNRATE")).toEqual([
            { date: "2026-08-01", value: null },
            { date: "2026-09-01", value: 4.2 },
            { date: "2026-10-01", value: 4.1 },
        ]);
    });

    it("updates revised values instead of duplicating them", () => {
        db.saveSeries(meta, [{ date: "2026-09-01", value: 4.3 }]);
        const obs = db.getObservations("UNRATE");
        expect(obs).toHaveLength(3);
        expect(obs.find((o) => o.date === "2026-09-01")?.value).toBe(4.3);
    });

    it("records ingest runs and finds the last successful one", () => {
        const ok = db.startRun();
        db.finishRun(ok, { status: "ok", seriesOk: 16, seriesFailed: 0, message: null });
        const failed = db.startRun();
        db.finishRun(failed, { status: "failed", seriesOk: 0, seriesFailed: 16, message: "network down" });

        expect(db.getLastRun()?.status).toBe("failed");
        expect(db.getLastSuccessfulRun()?.id).toBe(ok);
    });

    it("rejects observations for an unknown series (foreign keys are on)", () => {
        const sqlite = (globalThis as unknown as { __economyDb: { sqlite: import("better-sqlite3").Database } }).__economyDb.sqlite;
        expect(() => sqlite.prepare("INSERT INTO observations (series_id, date, value) VALUES ('NOPE', '2026-01-01', 1)").run()).toThrow();
    });

    it("rejects the wrong type in a STRICT table", () => {
        const sqlite = (globalThis as unknown as { __economyDb: { sqlite: import("better-sqlite3").Database } }).__economyDb.sqlite;
        expect(() =>
            sqlite.prepare("INSERT INTO observations (series_id, date, value) VALUES ('UNRATE', '2026-01-01', 'abc')").run(),
        ).toThrow();
    });

    it("writes a dated backup", async () => {
        const file = await db.backupDatabase();
        expect(file).toMatch(/economy-\d{4}-\d{2}-\d{2}\.db$/);
        expect(readdirSync(join(dir, "backups"))).toHaveLength(1);
    });
});
