// Builds the overview page from the data in SQLite.
// Each tile documents its scoring rule; the README mirrors these thresholds.
import {
    band,
    changeTone,
    clean,
    confirmationLevel,
    diffs,
    fedStance,
    formatAsOf,
    formatMonth,
    mean,
    monthlyLast,
    recessionLevel,
    recessionPeriods,
    shiftMonths,
    signed,
    thin,
    valueOnOrBefore,
    yoyPct,
    type Point,
    type Status,
} from "./compute";
import { getLastSuccessfulRun, getObservations } from "./db";
import type { SeriesId } from "./indicators";
import { LABELS, SPARK, countStatuses, last, levelTile, missing, yoyTile, type Tile, type TileBase } from "./tiles";

export type Group = { id: string; title: string; note: string; tiles: Tile[] };

export type ConfirmItem = { name: string; change: string; falling: boolean | null; asOf: string; source: string };

export type Overview = {
    hasData: boolean;
    updatedAt: string | null;
    recession: { probability: number; status: Status; label: string; asOf: string } | null;
    counts: Record<Status, number>;
    warnings: string[];
    confirmation: { items: ConfirmItem[]; falling: number; status: Status; label: string };
    groups: Group[];
    curve: { points: [string, number][]; recessions: { start: string; end: string }[] };
};

/** Cleaned, date-sorted observations for one series. */
export function pts(id: SeriesId): Point[] {
    return clean(getObservations(id));
}

// ---- Leading -----------------------------------------------------------------------------------

function leading(): Tile[] {
    const curve = pts("T10Y3M");
    const claims = pts("IC4WSA");
    return [
        // Inverted (< 0) is the warning; under 0.5 pp is flat.
        levelTile(
            {
                id: "yield-curve",
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
            },
        ),
        // 260K+ has marked past downturns; 230K+ is worth watching.
        levelTile(
            {
                id: "claims",
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
                changeDigits: 1,
                changeScale: 1 / 1000,
                changeUnit: "K",
                changeSuffix: " in 4 wk",
            },
        ),
        // Below 0 is contraction; below −10 is sharp contraction.
        levelTile(
            {
                id: "philly-fed",
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
        // Scored on the year-over-year change: below −15% is bad, below 0% is watch.
        yoyTile(
            {
                id: "permits",
                name: "Building permits",
                why: "Housing reacts first to interest rates and leads construction jobs.",
                lead: "6–12 mo lead",
                source: "FRED PERMIT",
            },
            pts("PERMIT"),
            {
                frequency: "M",
                thresholds: { bad: -15, watch: 0 },
                direction: "lower-is-worse",
                labels: LABELS("Falling fast", "Softening", "Growing"),
                format: (v) => `${(v / 1000).toFixed(2)}M`,
                unit: "annual rate",
            },
        ),
        // Below 55 is very weak, below 75 is weak.
        levelTile(
            {
                id: "sentiment",
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
        // Below −0.70 is the Chicago Fed's own recession signal.
        levelTile(
            {
                id: "cfnai",
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
    ];
}

// ---- Financial conditions ----------------------------------------------------------------------

function financial(): Tile[] {
    return [
        // 6 pp+ is credit stress; 4.5 pp+ is widening.
        levelTile(
            {
                id: "credit-spread",
                name: "High-yield credit spread",
                why: "Lenders demand more yield when they fear defaults. Above about 6 pp signals stress.",
                lead: "1–6 mo lead",
                source: "FRED BAMLH0A0HYM2",
            },
            pts("BAMLH0A0HYM2"),
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
            },
        ),
        // Above 0 means tighter than average (warning); above −0.25 is tightening toward average.
        levelTile(
            {
                id: "nfci",
                name: "Financial conditions",
                why: "Combines over 100 measures of risk, credit and leverage. Above zero means tighter than average.",
                lead: "3–9 mo lead",
                source: "FRED NFCI",
            },
            pts("NFCI"),
            {
                frequency: "W",
                thresholds: { bad: 0, watch: -0.25 },
                direction: "higher-is-worse",
                labels: LABELS("Tighter than average", "Tightening", "Loose"),
                format: (v) => signed(v, 2),
                unit: "index",
                compareDays: 28,
                changeDigits: 2,
                changeSuffix: " in 4 wk",
            },
        ),
        // Net share of banks tightening: 30%+ is sharp tightening, 10%+ is tightening.
        levelTile(
            {
                id: "lending-standards",
                name: "Bank lending standards",
                why: "Net share of banks tightening business-loan standards. Sharp tightening preceded recent recessions, but also flashed in 2023 without one.",
                lead: "6–12 mo lead",
                source: "FRED DRTSCILM",
            },
            pts("DRTSCILM"),
            {
                frequency: "Q",
                thresholds: { bad: 30, watch: 10 },
                direction: "higher-is-worse",
                labels: LABELS("Tightening sharply", "Tightening", "Steady or easing"),
                format: (v) => signed(v, 1),
                unit: "% net",
                changeDigits: 1,
                changeSuffix: " q/q",
            },
        ),
    ];
}

// ---- Labor -------------------------------------------------------------------------------------

function labor(): Tile[] {
    const tiles: Tile[] = [];

    // Scored on the Sahm rule: 0.50+ triggers it, 0.30+ is rising.
    {
        const base: TileBase = {
            id: "unemployment",
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

    // Scored on the 3-month average gain: below 0 is bad, below 100K is watch.
    {
        const base: TileBase = {
            id: "payrolls",
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

    // Scored on the year-over-year change: up 20%+ is bad, up 10%+ is watch.
    tiles.push(
        yoyTile(
            {
                id: "continuing-claims",
                name: "Continuing claims",
                why: "People still claiming benefits. Rising while new claims stay low means laid-off workers are slow to find jobs.",
                lead: "1–6 mo lead",
                source: "FRED CCSA",
            },
            pts("CCSA"),
            {
                frequency: "W",
                thresholds: { bad: 20, watch: 10 },
                direction: "higher-is-worse",
                labels: LABELS("Rising fast", "Rising", "Stable"),
                format: (v) => `${(v / 1_000_000).toFixed(2)}M`,
                unit: "people",
            },
        ),
    );

    // Scored on the year-over-year change: below −5% is bad, below 0% is watch.
    tiles.push(
        yoyTile(
            {
                id: "temp-help",
                name: "Temporary help jobs",
                why: "Firms cut temporary staff before permanent staff. It also fell through 2023–25 without a recession.",
                lead: "6–12 mo lead",
                source: "FRED TEMPHELPS",
            },
            pts("TEMPHELPS"),
            {
                frequency: "M",
                thresholds: { bad: -5, watch: 0 },
                direction: "lower-is-worse",
                labels: LABELS("Falling fast", "Declining", "Growing"),
                format: (v) => `${(v / 1000).toFixed(2)}M`,
                unit: "jobs",
            },
        ),
    );
    return tiles;
}

// ---- Growth ------------------------------------------------------------------------------------

function growth(): Tile[] {
    const gdp = pts("A191RL1Q225SBEA");
    const gdpScoring = {
        frequency: "Q",
        thresholds: { bad: 0, watch: 1.5 },
        direction: "lower-is-worse" as const,
        labels: LABELS("Contracting", "Below trend", "Solid"),
        format: (v: number) => v.toFixed(1),
        unit: "% annualized",
        changeDigits: 1,
        changeSuffix: " pp q/q",
    };
    return [
        // Below 0 is contraction; below 1.5% is below trend.
        levelTile(
            {
                id: "gdp",
                name: "Real GDP growth",
                why: "Long-run trend is about 2%. Two negative quarters is the popular recession rule of thumb.",
                lead: "Lagging",
                source: "FRED A191RL1Q225SBEA",
            },
            gdp,
            { ...gdpScoring, spark: gdp.slice(-12) },
        ),
        // Same thresholds as GDP, applied to the running estimate for the current quarter.
        levelTile(
            {
                id: "gdpnow",
                name: "GDPNow estimate",
                why: "The Atlanta Fed's running estimate of this quarter's growth, updated as new data arrives.",
                lead: "Real time",
                source: "FRED GDPNOW",
            },
            pts("GDPNOW"),
            { ...gdpScoring, asOfSuffix: " estimate", changeSuffix: " pp vs last qtr" },
        ),
    ];
}

// ---- Inflation and policy ----------------------------------------------------------------------

function policy(): Tile[] {
    const tiles: Tile[] = [];

    // Year over year: 3%+ is high, 2.5%+ is above target.
    {
        const base: TileBase = {
            id: "core-pce",
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

    // Stance from the 12-month change in the upper bound. Never scored "bad".
    {
        const base: TileBase = {
            id: "fed-funds",
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

// ---- Recession confirmation: the measures NBER's dating committee watches ----------------------

function confirmation(): Overview["confirmation"] {
    const pct = (id: SeriesId, name: string): ConfirmItem => {
        const p = pts(id);
        const latest = last(p);
        const before = p[p.length - 4];
        if (!latest || !before) return { name, change: "—", falling: null, asOf: "", source: `FRED ${id}` };
        const change = (latest.value / before.value - 1) * 100;
        return { name, change: `${signed(change, 1)}% in 3 mo`, falling: change < 0, asOf: formatAsOf(latest.date, "M"), source: `FRED ${id}` };
    };
    const payrolls = (): ConfirmItem => {
        const p = pts("PAYEMS");
        const latest = last(p);
        const before = p[p.length - 4];
        if (!latest || !before) return { name: "Payroll jobs", change: "—", falling: null, asOf: "", source: "FRED PAYEMS" };
        const change = latest.value - before.value;
        return { name: "Payroll jobs", change: `${signed(change, 0)}K in 3 mo`, falling: change < 0, asOf: formatAsOf(latest.date, "M"), source: "FRED PAYEMS" };
    };

    const items = [
        payrolls(),
        pct("W875RX1", "Real income excluding transfers"),
        pct("PCEC96", "Real consumer spending"),
        pct("INDPRO", "Industrial production"),
    ];
    const falling = items.filter((i) => i.falling).length;
    return { items, falling, ...confirmationLevel(falling) };
}

// ---- Page --------------------------------------------------------------------------------------

export function getOverview(): Overview {
    const lastRun = getLastSuccessfulRun();
    const groups: Group[] = [
        { id: "leading", title: "Leading indicators", note: "Turn 6–18 months before the economy does", tiles: leading() },
        { id: "financial", title: "Financial conditions", note: "Credit tightens before activity slows", tiles: financial() },
        { id: "labor", title: "Labor market", note: "Confirms what leading indicators predicted", tiles: labor() },
        { id: "growth", title: "Growth", note: "The scoreboard, plus a real-time estimate", tiles: growth() },
        { id: "policy", title: "Inflation and policy", note: "Sets how much room the Fed has to respond", tiles: policy() },
    ];
    const tiles = groups.flatMap((g) => g.tiles);

    const prob = last(pts("RECPROUSM156N"));
    const recession = prob ? { probability: prob.value, ...recessionLevel(prob.value), asOf: formatMonth(prob.date) } : null;

    const spread = pts("T10Y3M");
    const end = last(spread);
    const from = end ? shiftMonths(end.date, -120) : "";
    const curve = {
        points: thin(
            spread.filter((p) => p.date >= from),
            3,
        ).map((p) => [p.date, Math.round(p.value * 100) / 100] as [string, number]),
        recessions: recessionPeriods(pts("USREC")).filter((r) => r.end >= from),
    };

    return {
        hasData: tiles.some((t) => t.status !== "na"),
        updatedAt: lastRun?.finishedAt ?? null,
        recession,
        counts: countStatuses(tiles),
        warnings: tiles.filter((t) => t.status === "bad").map((t) => t.name),
        confirmation: confirmation(),
        groups,
        curve,
    };
}
