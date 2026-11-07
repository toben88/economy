// The tile shape every page renders, and builders for the two common scoring styles:
// levelTile scores the latest value, yoyTile scores the year-over-year change.
import {
    band,
    changeTone,
    formatAsOf,
    monthlyLast,
    shiftDays,
    signed,
    valueOnOrBefore,
    yoyPct,
    type Direction,
    type Point,
    type Status,
    type Tone,
} from "./compute";

export type Tile = {
    id: string;
    name: string;
    value: string;
    unit: string;
    change: string;
    tone: Tone;
    status: Status | "na";
    label: string;
    why: string;
    lead: string;
    source: string;
    asOf: string;
    spark: number[];
};

export type TileBase = Pick<Tile, "id" | "name" | "why" | "lead" | "source">;

export const SPARK = 36;

export const LABELS = (bad: string, watch: string, good: string): Record<Status, string> => ({ bad, watch, good });

export function last<T>(a: T[]): T | undefined {
    return a[a.length - 1];
}

export function missing(base: TileBase): Tile {
    return { ...base, value: "—", unit: "", change: "", tone: "flat", status: "na", label: "No data", asOf: "", spark: [] };
}

type Scoring = {
    /** FRED frequency code: D, W, M or Q. Daily and weekly sparklines use one point per month. */
    frequency: string;
    thresholds: { bad: number; watch: number };
    direction: Direction;
    labels: Record<Status, string>;
    format: (v: number) => string;
    unit: string;
    asOfSuffix?: string;
};

const coarse = (frequency: string) => /^[DW]/i.test(frequency);

/** Status from the latest value. */
export function levelTile(
    base: TileBase,
    points: Point[],
    o: Scoring & {
        /** Compare with the value this many days back; defaults to the previous observation. */
        compareDays?: number;
        changeDigits: number;
        changeSuffix: string;
        /** Scale the displayed change, for example 1/1000 to show thousands. */
        changeScale?: number;
        changeUnit?: string;
        spark?: Point[];
    },
): Tile {
    const latest = last(points);
    if (!latest) return missing(base);
    const before = o.compareDays ? valueOnOrBeforeDays(points, latest.date, o.compareDays) : points[points.length - 2];
    const change = before ? latest.value - before.value : 0;
    const status = band(latest.value, o.thresholds, o.direction);
    const spark = o.spark ?? (coarse(o.frequency) ? monthlyLast(points) : points);
    return {
        ...base,
        value: o.format(latest.value),
        unit: o.unit,
        change: before ? `${signed(change * (o.changeScale ?? 1), o.changeDigits)}${o.changeUnit ?? ""}${o.changeSuffix}` : "",
        tone: changeTone(change, o.direction),
        status,
        label: o.labels[status],
        asOf: formatAsOf(latest.date, o.frequency) + (o.asOfSuffix ?? ""),
        spark: spark.slice(-SPARK).map((p) => p.value),
    };
}

function valueOnOrBeforeDays(points: Point[], date: string, days: number): Point | undefined {
    return valueOnOrBefore(points, shiftDays(date, -days));
}

/** Shows the latest level, but scores and charts the year-over-year percent change. */
export function yoyTile(base: TileBase, points: Point[], o: Scoring): Tile {
    const latest = last(points);
    const yoy = yoyPct(points, coarse(o.frequency) ? 10 : 31);
    const latestYoy = last(yoy);
    if (!latest || !latestYoy) return missing(base);
    const status = band(latestYoy.value, o.thresholds, o.direction);
    return {
        ...base,
        value: o.format(latest.value),
        unit: o.unit,
        change: `${signed(latestYoy.value, 1)}% y/y`,
        tone: changeTone(latestYoy.value, o.direction),
        status,
        label: o.labels[status],
        asOf: formatAsOf(latest.date, o.frequency) + (o.asOfSuffix ?? ""),
        spark: (coarse(o.frequency) ? monthlyLast(yoy) : yoy).slice(-SPARK).map((p) => p.value),
    };
}

export function countStatuses(tiles: Tile[]): Record<Status, number> {
    const counts: Record<Status, number> = { good: 0, watch: 0, bad: 0 };
    for (const t of tiles) if (t.status !== "na") counts[t.status]++;
    return counts;
}
