// Schema changes, applied in order at startup. Never edit a migration that has shipped: add a new one.
// Tables are STRICT and dates are ISO-8601 text, so a later move to MariaDB or Postgres stays mechanical.

export type Migration = { id: number; name: string; sql: string };

export const MIGRATIONS: Migration[] = [
    {
        id: 1,
        name: "init",
        sql: `
CREATE TABLE series (
    id                TEXT PRIMARY KEY,
    title             TEXT NOT NULL,
    units             TEXT NOT NULL,
    frequency         TEXT NOT NULL,
    fred_last_updated TEXT,
    fetched_at        TEXT NOT NULL
) STRICT;

CREATE TABLE observations (
    series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    date      TEXT NOT NULL,
    value     REAL,
    PRIMARY KEY (series_id, date)
) STRICT;

CREATE TABLE ingest_runs (
    id            INTEGER PRIMARY KEY,
    started_at    TEXT NOT NULL,
    finished_at   TEXT,
    status        TEXT NOT NULL CHECK (status IN ('running', 'ok', 'partial', 'failed')),
    series_ok     INTEGER NOT NULL DEFAULT 0,
    series_failed INTEGER NOT NULL DEFAULT 0,
    message       TEXT
) STRICT;
`,
    },
];
