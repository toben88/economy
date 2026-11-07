// Detail pages: more recession indicators, grouped by theme. These tiles are scored with the same
// rules as the overview but are not counted in the overview's warning signals.
import { band, changeTone, formatAsOf, recentlyBelow, shiftDays, shiftMonths, signed, valueOnOrBefore } from "./compute";
import { pts, type Group } from "./dashboard";
import { getLastSuccessfulRun } from "./db";
import { LABELS, SPARK, countStatuses, last, levelTile, missing, yoyTile, type Tile, type TileBase } from "./tiles";
import type { Status } from "./compute";

export type DetailPage = {
    slug: string;
    title: string;
    intro: string;
    updatedAt: string | null;
    counts: Record<Status, number>;
    groups: Group[];
};

// ---- Labor -------------------------------------------------------------------------------------

function laborPage(): Omit<DetailPage, "updatedAt" | "counts"> {
    // Factory hours: scored on the change over 12 months (down 0.5 hr+ is bad, any fall is watch).
    const hoursBase: TileBase = {
        id: "factory-hours",
        name: "Factory workweek",
        why: "Employers cut hours before they cut jobs. A component of the Conference Board leading index.",
        lead: "3–6 mo lead",
        source: "FRED AWHMAN",
    };
    const hours = pts("AWHMAN");
    const latestHours = last(hours);
    const yearAgoHours = latestHours ? valueOnOrBefore(hours, shiftMonths(latestHours.date, -12)) : undefined;
    let hoursTile: Tile = missing(hoursBase);
    if (latestHours && yearAgoHours) {
        const change = latestHours.value - yearAgoHours.value;
        const status = band(change, { bad: -0.5, watch: 0 }, "lower-is-worse");
        hoursTile = {
            ...hoursBase,
            value: latestHours.value.toFixed(1),
            unit: "hours a week",
            change: `${signed(change, 1)} hr y/y`,
            tone: changeTone(change, "lower-is-worse"),
            status,
            label: LABELS("Cut sharply", "Shortening", "Steady")[status],
            asOf: formatAsOf(latestHours.date, "M"),
            spark: hours.slice(-SPARK).map((p) => p.value),
        };
    }

    return {
        slug: "labor",
        title: "Labor market detail",
        intro: "The job market usually cracks in a set order: hours are cut, hiring slows and workers stop quitting, then layoffs rise. These measures watch the early steps.",
        groups: [
            {
                id: "early",
                title: "Early warning",
                note: "Employers trim hours and hiring before they lay people off",
                tiles: [
                    hoursTile,
                    // Year over year: down 15%+ is bad, any fall is watch.
                    yoyTile(
                        {
                            id: "openings",
                            name: "Job openings",
                            why: "Fewer openings mean slower hiring ahead. Published about five weeks after the month ends.",
                            lead: "3–6 mo lead",
                            source: "FRED JTSJOL",
                        },
                        pts("JTSJOL"),
                        {
                            frequency: "M",
                            thresholds: { bad: -15, watch: 0 },
                            direction: "lower-is-worse",
                            labels: LABELS("Falling fast", "Declining", "Rising"),
                            format: (v) => `${(v / 1000).toFixed(1)}M`,
                            unit: "openings",
                        },
                    ),
                    // Below 2.0% is very low, below 2.3% (the pre-2020 norm) is below normal.
                    levelTile(
                        {
                            id: "quits",
                            name: "Quits rate",
                            why: "Workers quit when they are confident of finding another job. A falling rate signals caution.",
                            lead: "Coincident",
                            source: "FRED JTSQUR",
                        },
                        pts("JTSQUR"),
                        {
                            frequency: "M",
                            thresholds: { bad: 2.0, watch: 2.3 },
                            direction: "lower-is-worse",
                            labels: LABELS("Very low", "Below normal", "Healthy"),
                            format: (v) => v.toFixed(1),
                            unit: "% of workers",
                            changeDigits: 1,
                            changeSuffix: " pp m/m",
                        },
                    ),
                ],
            },
        ],
    };
}

// ---- Credit ------------------------------------------------------------------------------------

function creditPage(): Omit<DetailPage, "updatedAt" | "counts"> {
    // 10Y–2Y: inverted is bad, under 0.5 pp is flat, and positive after an inversion in the past
    // year is flagged too, because recessions have tended to start soon after the curve re-steepens.
    const curveBase: TileBase = {
        id: "curve-2y",
        name: "Yield curve (10Y–2Y)",
        why: "",
        lead: "6–18 mo lead",
        source: "FRED T10Y2Y",
    };
    const curve = pts("T10Y2Y");
    let curveTile = levelTile(curveBase, curve, {
        frequency: "D",
        thresholds: { bad: 0, watch: 0.5 },
        direction: "lower-is-worse",
        labels: LABELS("Inverted", "Flat", "Positive"),
        format: (v) => signed(v, 2),
        unit: "pp",
        compareDays: 30,
        changeDigits: 2,
        changeSuffix: " in 1 mo",
    });
    const latestCurve = last(curve);
    if (latestCurve) {
        const unInverted = latestCurve.value >= 0 && recentlyBelow(curve, shiftDays(latestCurve.date, -365), 0);
        curveTile = {
            ...curveTile,
            ...(unInverted ? { status: "watch" as const, label: "Recently un-inverted" } : {}),
            why: unInverted
                ? "Back above zero after an inversion within the past year. Recessions have tended to start soon after this re-steepening."
                : "The other widely watched curve. Recessions have tended to start soon after it re-steepens from an inversion.",
        };
    }

    return {
        slug: "credit",
        title: "Credit and financial conditions",
        intro: "Recessions usually arrive through credit: lenders grow cautious, borrowing costs rise for weaker firms and households, and spending follows. These measures watch for that strain.",
        groups: [
            {
                id: "stress",
                title: "Market stress",
                note: "How nervous lenders and investors are",
                tiles: [
                    // Above 1 is high stress, above 0 (the long-run average) is above normal.
                    levelTile(
                        {
                            id: "stress-index",
                            name: "Financial stress index",
                            why: "St. Louis Fed index of 18 market measures. Zero is normal; above zero means above-average stress.",
                            lead: "1–6 mo lead",
                            source: "FRED STLFSI4",
                        },
                        pts("STLFSI4"),
                        {
                            frequency: "W",
                            thresholds: { bad: 1, watch: 0 },
                            direction: "higher-is-worse",
                            labels: LABELS("High stress", "Above normal", "Below normal"),
                            format: (v) => signed(v, 2),
                            unit: "index",
                            compareDays: 28,
                            changeDigits: 2,
                            changeSuffix: " in 4 wk",
                        },
                    ),
                    // 3 pp+ is stressed, 2.3 pp+ is widening.
                    levelTile(
                        {
                            id: "baa-spread",
                            name: "Investment-grade spread",
                            why: "Extra yield on Baa-rated company bonds over Treasuries. It widened sharply before and during past recessions.",
                            lead: "1–6 mo lead",
                            source: "FRED BAA10Y",
                        },
                        pts("BAA10Y"),
                        {
                            frequency: "D",
                            thresholds: { bad: 3, watch: 2.3 },
                            direction: "higher-is-worse",
                            labels: LABELS("Stressed", "Widening", "Calm"),
                            format: (v) => v.toFixed(2),
                            unit: "pp",
                            compareDays: 30,
                            changeDigits: 2,
                            changeSuffix: " in 1 mo",
                        },
                    ),
                ],
            },
            { id: "curve", title: "Yield curve", note: "A second view of the curve", tiles: [curveTile] },
            {
                id: "consumer-credit",
                title: "Consumer credit",
                note: "Strain shows up in missed payments",
                tiles: [
                    // 4%+ is high, 3%+ is elevated.
                    levelTile(
                        {
                            id: "card-delinquency",
                            name: "Credit card delinquencies",
                            why: "Share of card balances 30+ days overdue. Slow: published about two months after the quarter.",
                            lead: "Coincident",
                            source: "FRED DRCCLACBS",
                        },
                        pts("DRCCLACBS"),
                        {
                            frequency: "Q",
                            thresholds: { bad: 4, watch: 3 },
                            direction: "higher-is-worse",
                            labels: LABELS("High", "Elevated", "Normal"),
                            format: (v) => v.toFixed(2),
                            unit: "% of balances",
                            changeDigits: 2,
                            changeSuffix: " pp q/q",
                        },
                    ),
                ],
            },
        ],
    };
}

// ---- Activity ----------------------------------------------------------------------------------

function activityPage(): Omit<DetailPage, "updatedAt" | "counts"> {
    return {
        slug: "activity",
        title: "Business and consumer activity",
        intro: "What companies and households are actually doing: ordering equipment, building, shipping, buying and saving. Plus oil prices and a second recession model.",
        groups: [
            {
                id: "business",
                title: "Business",
                note: "Investment, building and freight",
                tiles: [
                    // Year over year: down 5%+ is bad, any fall is watch.
                    yoyTile(
                        {
                            id: "core-capex",
                            name: "Core capital goods orders",
                            why: "Orders for business equipment, excluding defense and aircraft. A guide to investment spending ahead.",
                            lead: "3–6 mo lead",
                            source: "FRED NEWORDER",
                        },
                        pts("NEWORDER"),
                        {
                            frequency: "M",
                            thresholds: { bad: -5, watch: 0 },
                            direction: "lower-is-worse",
                            labels: LABELS("Falling", "Flat to down", "Growing"),
                            format: (v) => `$${(v / 1000).toFixed(1)}B`,
                            unit: "a month",
                        },
                    ),
                    // Year over year: down 15%+ is bad, any fall is watch.
                    yoyTile(
                        {
                            id: "housing-starts",
                            name: "Housing starts",
                            why: "New homes started. Housing turns down early when interest rates bite.",
                            lead: "6–12 mo lead",
                            source: "FRED HOUST",
                        },
                        pts("HOUST"),
                        {
                            frequency: "M",
                            thresholds: { bad: -15, watch: 0 },
                            direction: "lower-is-worse",
                            labels: LABELS("Falling fast", "Softening", "Growing"),
                            format: (v) => `${(v / 1000).toFixed(2)}M`,
                            unit: "annual rate",
                        },
                    ),
                    // Year over year: down 5%+ is bad, any fall is watch.
                    yoyTile(
                        {
                            id: "truck-tonnage",
                            name: "Truck tonnage",
                            why: "Freight moved by truck, a physical read on the goods economy. Published about two months late.",
                            lead: "Coincident",
                            source: "FRED TRUCKD11",
                        },
                        pts("TRUCKD11"),
                        {
                            frequency: "M",
                            thresholds: { bad: -5, watch: 0 },
                            direction: "lower-is-worse",
                            labels: LABELS("Falling", "Softening", "Growing"),
                            format: (v) => v.toFixed(1),
                            unit: "index",
                        },
                    ),
                ],
            },
            {
                id: "consumers",
                title: "Consumers",
                note: "Spending, big-ticket purchases and savings",
                tiles: [
                    // Year over year: below −1% is bad, below +1% is watch.
                    yoyTile(
                        {
                            id: "retail-sales",
                            name: "Real retail sales",
                            why: "Store and restaurant sales adjusted for inflation. Falling real sales mean households are pulling back.",
                            lead: "Coincident",
                            source: "FRED RRSFS",
                        },
                        pts("RRSFS"),
                        {
                            frequency: "M",
                            thresholds: { bad: -1, watch: 1 },
                            direction: "lower-is-worse",
                            labels: LABELS("Shrinking", "Stalling", "Growing"),
                            format: (v) => `$${(v / 1000).toFixed(0)}B`,
                            unit: "a month, real",
                        },
                    ),
                    // Year over year: down 10%+ is bad, any fall is watch.
                    yoyTile(
                        {
                            id: "vehicle-sales",
                            name: "Vehicle sales",
                            why: "Cars and light trucks are big, rate-sensitive purchases that households postpone first.",
                            lead: "3–6 mo lead",
                            source: "FRED TOTALSA",
                        },
                        pts("TOTALSA"),
                        {
                            frequency: "M",
                            thresholds: { bad: -10, watch: 0 },
                            direction: "lower-is-worse",
                            labels: LABELS("Falling fast", "Softening", "Growing"),
                            format: (v) => `${v.toFixed(1)}M`,
                            unit: "annual rate",
                        },
                    ),
                    // Below 3% is very low, below 4.5% is low.
                    levelTile(
                        {
                            id: "saving-rate",
                            name: "Personal saving rate",
                            why: "Share of after-tax income saved. A low rate leaves households less cushion if jobs are lost.",
                            lead: "Backdrop",
                            source: "FRED PSAVERT",
                        },
                        pts("PSAVERT"),
                        {
                            frequency: "M",
                            thresholds: { bad: 3, watch: 4.5 },
                            direction: "lower-is-worse",
                            labels: LABELS("Very low", "Low", "Healthy"),
                            format: (v) => v.toFixed(1),
                            unit: "% of income",
                            changeDigits: 1,
                            changeSuffix: " pp m/m",
                        },
                    ),
                ],
            },
            {
                id: "prices-models",
                title: "Oil and models",
                note: "An old recession trigger and a second model",
                tiles: [
                    // Year over year: up 50%+ is a price shock, up 25%+ is rising fast.
                    yoyTile(
                        {
                            id: "oil",
                            name: "Crude oil (WTI)",
                            why: "Oil price spikes preceded several past recessions, though the link is weaker in today's economy.",
                            lead: "6–12 mo lead",
                            source: "FRED DCOILWTICO",
                        },
                        pts("DCOILWTICO"),
                        {
                            frequency: "D",
                            thresholds: { bad: 50, watch: 25 },
                            direction: "higher-is-worse",
                            labels: LABELS("Price shock", "Rising fast", "Stable"),
                            format: (v) => `$${v.toFixed(2)}`,
                            unit: "a barrel",
                        },
                    ),
                    // Hamilton's own rule: above 67% calls a recession; 33%+ is elevated.
                    levelTile(
                        {
                            id: "hamilton",
                            name: "GDP-based recession index",
                            why: "James Hamilton's model from GDP alone. Above 67% has called recession starts. Published about five months after the quarter.",
                            lead: "Lagging",
                            source: "FRED JHGDPBRINDX",
                        },
                        pts("JHGDPBRINDX"),
                        {
                            frequency: "Q",
                            thresholds: { bad: 67, watch: 33 },
                            direction: "higher-is-worse",
                            labels: LABELS("Recession signal", "Elevated", "Low"),
                            format: (v) => v.toFixed(1),
                            unit: "%",
                            changeDigits: 1,
                            changeSuffix: " pp q/q",
                        },
                    ),
                ],
            },
        ],
    };
}

const BUILDERS: Record<string, () => Omit<DetailPage, "updatedAt" | "counts">> = {
    labor: laborPage,
    credit: creditPage,
    activity: activityPage,
};

export const DETAIL_SLUGS = Object.keys(BUILDERS);

export function getDetailPage(slug: string): DetailPage | null {
    const build = BUILDERS[slug];
    if (!build) return null;
    const page = build();
    return {
        ...page,
        updatedAt: getLastSuccessfulRun()?.finishedAt ?? null,
        counts: countStatuses(page.groups.flatMap((g) => g.tiles)),
    };
}
