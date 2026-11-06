// Builds everything the overview page shows from the data in SQLite.
// Each tile documents its scoring rule; the README mirrors these thresholds.
import {
    band,
    changeTone,
    clean,
    diffs,
    fedStance,
    formatAsOf,
    formatMonth,
    mean,
    monthlyLast,
    recessionLevel,
    recessionPeriods,
    shiftDays,
    shiftMonths,
    signed,
    thin,
    valueOnOrBefore,
    yoyPct,
    type Direction,
    type Point,
    type Status,
    type Tone,
} from "./compute";
import { getLastSuccessfulRun, getObservations } from "./db";
import { GROUPS, type GroupId, type SeriesId } from "./indicators";

export type Tile = {
    id: string;
    group: GroupId;
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

export type Dashboard = {
    hasData: boolean;
    updatedAt: string | null;
    recession: { probability: number; status: Status; label: string; asOf: string } | null;
    counts: Record<Status, number>;
    warnings: string[];
    groups: { id: GroupId; title: string; note: string; tiles: Tile[] }[];
    curve: { points: [string, number][]; recessions: { start: string; end: string }[] };
};

const SPARK = 36;

function pts(id: SeriesId): Point[] {
    return clean(getObservations(id));
}

function last<T>(a: T[]): T | undefined {
    return a[a.length - 1];
}

type TileBase = Pick<Tile, "id" | "group" | "name" | "why" | "lead" | "source">;

function missing(base: TileBase): Tile {
    return { ...base, value: "—", unit: "", change: "", tone: "flat", status: "na", label: "No data", asOf: "", spark: [] };
}

const LABELS = (bad: string, watch: string, good: string): Record<Status, string> => ({ bad, watch, good });

/** A tile whose status comes straight from its latest value. */
function simple(
    base: TileBase,
    points: Point[],
    o: {
        frequency: string;
        thresholds: { bad: number; watch: number };
        direction: Direction;
        labels: Record<Status, string>;
        format: (v: number) => string;
        unit: string;
        /** Compare with the value this far back; defaults to the previous observation. */
        compareDays?: number;
        changeDigits: number;
        changeSuffix: string;
        spark?: Point[];
    },
): Tile {
    const latest = last(points);
    if (!latest) return missing(base);
    const before = o.compareDays
        ? valueOnOrBefore(points, shiftDays(latest.date, -o.compareDays))
        : points[points.length - 2];
    const change = before ? latest.value - before.value : 0;
    const status = band(latest.value, o.thresholds, o.direction);
    return {
        ...base,
        value: o.format(latest.value),
        unit: o.unit,
        change: before ? `${signed(change, o.changeDigits)}${o.changeSuffix}` : "",
        tone: changeTone(change, o.direction),
        status,
        label: o.labels[status],
        asOf: formatAsOf(latest.date, o.frequency),
        spark: (o.spark ?? points).slice(-SPARK).map((p) => p.value),
    };
}

function buildTiles(): Tile[] {
    const tiles: Tile[] = [];

    // ---- Leading -------------------------------------------------------------------------------

    // Yield curve: inverted (< 0) is the warning; under 0.5 pp is flat.
    const curve = pts("T10Y3M");
    tiles.push(
        simple(
            {
                id: "yield-curve",
                group: "leading",
                name: "Yield curve (10Y–3M)",
                why: "An inversion (below zero) has preceded each of the last eight US recessions.",
                lead: "6–18 mo lead",
                source: "FRED T10Y3M",
            },
            curve,
            {
                frequency: "D",
                thresholds: { bad: 0, watch: 0.5 },
                direction: "lower-is-worse",
                labels: LABELS("Inverted", "Flat", "Positive"),
                format: (v) => signed(v, 2),
                unit: "pp",
                compareDays: 30,
                changeDigits: 2,
                changeSuffix: " in 1 mo",
                spark: monthlyLast(curve),
            },
        ),
    );

    // Jobless claims: 260K+ has marked past downturns; 230K+ is worth watching.
    const claims = pts("IC4WSA");
    tiles.push(
        simple(
            {
                id: "claims",
                group: "leading",
                name: "Initial jobless claims",
                why: "Weekly and timely. A sustained climb above about 260K has marked past downturns.",
                lead: "3–6 mo lead",
                source: "FRED IC4WSA",
            },
            claims,
            {
                frequency: "W",
                thresholds: { bad: 260_000, watch: 230_000 },
                direction: "higher-is-worse",
                labels: LABELS("Elevated", "Rising", "Low"),
                format: (v) => `${Math.round(v / 1000)}K`,
                unit: "4-wk avg",
                compareDays: 28,
                changeDigits: 0,
                changeSuffix: " in 4 wk",
                spark: monthlyLast(claims),
            },
        ),
    );
    // Show the claims change in thousands rather than raw counts
    const claimsTile = tiles[tiles.length - 1];
    if (claimsTile.status !== "na" && claims.length) {
        const latest = claims[claims.length - 1];
        const before = valueOnOrBefore(claims, shiftDays(latest.date, -28));
        if (before) claimsTile.change = `${signed((latest.value - before.value) / 1000, 1)}K in 4 wk`;
    }

    // Philadelphia Fed manufacturing: below 0 is contraction; below −10 is sharp contraction.
    tiles.push(
        simple(
            {
                id: "philly-fed",
                group: "leading",
                name: "Philly Fed manufacturing",
                why: "Diffusion index of regional factory activity. Below zero means more firms report a decline.",
                lead: "3–6 mo lead",
                source: "FRED GACDFSA066MSFRBPHI",
            },
            pts("GACDFSA066MSFRBPHI"),
            {
                frequency: "M",
                thresholds: { bad: -10, watch: 0 },
                direction: "lower-is-worse",
                labels: LABELS("Contracting sharply", "Contracting", "Expanding"),
                format: (v) => signed(v, 1),
                unit: "index",
                changeDigits: 1,
                changeSuffix: " m/m",
            },
        ),
    );

    // Building permits: scored on the year-over-year change (below −15% is bad, below 0% is watch).
    {
        const base: TileBase = {
            id: "permits",
            group: "leading",
            name: "Building permits",
            why: "Housing reacts first to interest rates and leads construction jobs.",
            lead: "6–12 mo lead",
            source: "FRED PERMIT",
        };
        const permits = pts("PERMIT");
        const yoy = yoyPct(permits);
        const latest = last(permits);
        const latestYoy = last(yoy);
        if (!latest || !latestYoy) tiles.push(missing(base));
        else {
            const status = band(latestYoy.value, { bad: -15, watch: 0 }, "lower-is-worse");
            tiles.push({
                ...base,
                value: `${(latest.value / 1000).toFixed(2)}M`,
                unit: "annual rate",
                change: `${signed(latestYoy.value, 1)}% y/y`,
                tone: changeTone(latestYoy.value, "lower-is-worse"),
                status,
                label: LABELS("Falling fast", "Softening", "Growing")[status],
                asOf: formatAsOf(latest.date, "M"),
                spark: permits.slice(-SPARK).map((p) => p.value),
            });
        }
    }

    // Consumer sentiment: below 55 is very weak, below 75 is weak.
    tiles.push(
        simple(
            {
                id: "sentiment",
                group: "leading",
                name: "Consumer sentiment",
                why: "Expectations shape spending, which is about two-thirds of GDP.",
                lead: "3–9 mo lead",
                source: "FRED UMCSENT",
            },
            pts("UMCSENT"),
            {
                frequency: "M",
                thresholds: { bad: 55, watch: 75 },
                direction: "lower-is-worse",
                labels: LABELS("Very weak", "Weak", "Healthy"),
                format: (v) => v.toFixed(1),
                unit: "index",
                changeDigits: 1,
                changeSuffix: " m/m",
            },
        ),
    );

    // High-yield spread: 6 pp+ is credit stress; 4.5 pp+ is widening.
    const hy = pts("BAMLH0A0HYM2");
    tiles.push(
        simple(
            {
                id: "credit-spread",
                group: "leading",
                name: "High-yield credit spread",
                why: "Lenders demand more yield when they fear defaults. Above about 6 pp signals stress.",
                lead: "1–6 mo lead",
                source: "FRED BAMLH0A0HYM2",
            },
            hy,
            {
                frequency: "D",
                thresholds: { bad: 6, watch: 4.5 },
                direction: "higher-is-worse",
                labels: LABELS("Stressed", "Widening", "Calm"),
                format: (v) => v.toFixed(2),
                unit: "pp",
                compareDays: 30,
                changeDigits: 2,
                changeSuffix: " in 1 mo",
                spark: monthlyLast(hy),
            },
        ),
    );

    // Chicago Fed activity index (3-month average): below −0.70 is the Chicago Fed's own recession signal.
    tiles.push(
        simple(
            {
                id: "cfnai",
                group: "leading",
                name: "Chicago Fed activity index",
                why: "Combines 85 monthly series. A 3-month average below −0.70 has signalled recessions.",
                lead: "Coincident to leading",
                source: "FRED CFNAIMA3",
            },
            pts("CFNAIMA3"),
            {
                frequency: "M",
                thresholds: { bad: -0.7, watch: 0 },
                direction: "lower-is-worse",
                labels: LABELS("Recession signal", "Below trend", "Above trend"),
                format: (v) => signed(v, 2),
                unit: "3-mo avg",
                changeDigits: 2,
                changeSuffix: " m/m",
            },
        ),
    );

    // ---- Labor ---------------------------------------------------------------------------------

    // Unemployment: scored on the Sahm rule (0.50+ triggers it, 0.30+ is rising).
    {
        const base: TileBase = {
            id: "unemployment",
            group: "labor",
            name: "Unemployment rate",
            why: "",
            lead: "Coincident",
            source: "FRED UNRATE · SAHMREALTIME",
        };
        const u = pts("UNRATE");
        const sahm = last(pts("SAHMREALTIME"));
        const latest = last(u);
        const prev = u[u.length - 2];
        if (!latest || !sahm) tiles.push(missing({ ...base, why: "Scored on the Sahm rule." }));
        else {
            const status = band(sahm.value, { bad: 0.5, watch: 0.3 }, "higher-is-worse");
            const change = prev ? latest.value - prev.value : 0;
            tiles.push({
                ...base,
                why: `Sahm rule at ${sahm.value.toFixed(2)}. A reading of 0.50 or more has signalled every recession since 1970.`,
                value: latest.value.toFixed(1),
                unit: "%",
                change: prev ? `${signed(change, 1)} pp m/m` : "",
                tone: changeTone(change, "higher-is-worse"),
                status,
                label: LABELS("Sahm triggered", "Sahm rising", "Stable")[status],
                asOf: formatAsOf(latest.date, "M"),
                spark: u.slice(-SPARK).map((p) => p.value),
            });
        }
    }

    // Payrolls: scored on the 3-month average gain (below 0 is bad, below 100K is watch).
    {
        const base: TileBase = {
            id: "payrolls",
            group: "labor",
            name: "Nonfarm payrolls",
            why: "Below about 100K jobs a month is not enough to keep unemployment steady.",
            lead: "Coincident",
            source: "FRED PAYEMS",
        };
        const gains = diffs(pts("PAYEMS"));
        const latest = last(gains);
        if (!latest || gains.length < 3) tiles.push(missing(base));
        else {
            const avg3 = mean(gains.slice(-3).map((p) => p.value));
            const status = band(avg3, { bad: 0, watch: 100 }, "lower-is-worse");
            tiles.push({
                ...base,
                value: `${signed(latest.value, 0)}K`,
                unit: "jobs last month",
                change: `3-mo avg ${signed(avg3, 0)}K`,
                tone: "flat",
                status,
                label: LABELS("Shrinking", "Slowing", "Growing")[status],
                asOf: formatAsOf(latest.date, "M"),
                spark: gains.slice(-SPARK).map((p) => p.value),
            });
        }
    }

    // ---- Growth --------------------------------------------------------------------------------

    // Real GDP growth: below 0 is contraction; below 1.5% is below trend.
    tiles.push(
        simple(
            {
                id: "gdp",
                group: "growth",
                name: "Real GDP growth",
                why: "Long-run trend is about 2%. Two negative quarters is the popular recession rule of thumb.",
                lead: "Lagging",
                source: "FRED A191RL1Q225SBEA",
            },
            pts("A191RL1Q225SBEA"),
            {
                frequency: "Q",
                thresholds: { bad: 0, watch: 1.5 },
                direction: "lower-is-worse",
                labels: LABELS("Contracting", "Below trend", "Solid"),
                format: (v) => v.toFixed(1),
                unit: "% annualized",
                changeDigits: 1,
                changeSuffix: " pp q/q",
                spark: pts("A191RL1Q225SBEA").slice(-12),
            },
        ),
    );

    // ---- Inflation and policy ------------------------------------------------------------------

    // Core PCE inflation, year over year: 3%+ is high, 2.5%+ is above target.
    {
        const base: TileBase = {
            id: "core-pce",
            group: "policy",
            name: "Core PCE inflation",
            why: "The Fed's preferred gauge. The target is 2%; above it keeps rates higher for longer.",
            lead: "Lagging",
            source: "FRED PCEPILFE",
        };
        const yoy = yoyPct(pts("PCEPILFE"));
        const latest = last(yoy);
        const prev = yoy[yoy.length - 2];
        if (!latest) tiles.push(missing(base));
        else {
            const status = band(latest.value, { bad: 3, watch: 2.5 }, "higher-is-worse");
            const change = prev ? latest.value - prev.value : 0;
            tiles.push({
                ...base,
                value: latest.value.toFixed(1),
                unit: "% y/y",
                change: prev ? `${signed(change, 1)} pp m/m` : "",
                tone: changeTone(change, "higher-is-worse"),
                status,
                label: LABELS("High", "Above target", "Near target")[status],
                asOf: formatAsOf(latest.date, "M"),
                spark: yoy.slice(-SPARK).map((p) => p.value),
            });
        }
    }

    // Fed funds target range: stance from the 12-month change in the upper bound. Never scored "bad".
    {
        const base: TileBase = {
            id: "fed-funds",
            group: "policy",
            name: "Fed funds target",
            why: "Rate cuts support growth with a lag of 12 to 18 months; hikes slow it.",
            lead: "Policy",
            source: "FRED DFEDTARL · DFEDTARU",
        };
        const lower = last(pts("DFEDTARL"));
        const upper = pts("DFEDTARU");
        const latest = last(upper);
        if (!lower || !latest) tiles.push(missing(base));
        else {
            const yearAgo = valueOnOrBefore(upper, shiftMonths(latest.date, -12));
            const change = yearAgo ? latest.value - yearAgo.value : 0;
            const stance = fedStance(change);
            tiles.push({
                ...base,
                value: `${lower.value.toFixed(2)}–${latest.value.toFixed(2)}`,
                unit: "%",
                change: yearAgo ? `${signed(change, 2)} pp in 12 mo` : "",
                tone: "flat",
                status: stance.status,
                label: stance.label,
                asOf: formatAsOf(latest.date, "D"),
                spark: monthlyLast(upper).slice(-SPARK).map((p) => p.value),
            });
        }
    }

    return tiles;
}

export function getDashboard(): Dashboard {
    const lastRun = getLastSuccessfulRun();
    const tiles = buildTiles();

    const counts: Record<Status, number> = { good: 0, watch: 0, bad: 0 };
    for (const t of tiles) if (t.status !== "na") counts[t.status]++;

    const prob = last(pts("RECPROUSM156N"));
    const recession = prob
        ? { probability: prob.value, ...recessionLevel(prob.value), asOf: formatMonth(prob.date) }
        : null;

    const spread = pts("T10Y3M");
    const end = last(spread);
    const from = end ? shiftMonths(end.date, -120) : "";
    const recent = spread.filter((p) => p.date >= from);
    const curve = {
        points: thin(recent, 3).map((p) => [p.date, Math.round(p.value * 100) / 100] as [string, number]),
        recessions: recessionPeriods(pts("USREC")).filter((r) => r.end >= from),
    };

    return {
        hasData: tiles.some((t) => t.status !== "na"),
        updatedAt: lastRun?.finishedAt ?? null,
        recession,
        counts,
        warnings: tiles.filter((t) => t.status === "bad").map((t) => t.name),
        groups: GROUPS.map((g) => ({ ...g, tiles: tiles.filter((t) => t.group === g.id) })),
        curve,
    };
}
