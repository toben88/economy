// Drizzle table definitions for typed queries. Must match lib/migrations.ts.
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const series = sqliteTable("series", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    units: text("units").notNull(),
    frequency: text("frequency").notNull(),
    fredLastUpdated: text("fred_last_updated"),
    fetchedAt: text("fetched_at").notNull(),
});

export const observations = sqliteTable(
    "observations",
    {
        seriesId: text("series_id")
            .notNull()
            .references(() => series.id, { onDelete: "cascade" }),
        date: text("date").notNull(),
        value: real("value"),
    },
    (t) => [primaryKey({ columns: [t.seriesId, t.date] })],
);

export const ingestRuns = sqliteTable("ingest_runs", {
    id: integer("id").primaryKey(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    status: text("status", { enum: ["running", "ok", "partial", "failed"] }).notNull(),
    seriesOk: integer("series_ok").notNull().default(0),
    seriesFailed: integer("series_failed").notNull().default(0),
    message: text("message"),
});
