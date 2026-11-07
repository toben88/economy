// Pure calculations and formatting. No database or network access, so everything here is unit-tested.

export type Obs = { date: string; value: number | null };
export type Point = { date: string; value: number };
export type Status = "good" | "watch" | "bad";
/** Which way is bad news: "lower-is-worse" for things like GDP, "higher-is-worse" for things like claims. */
export type Direction = "lower-is-worse" | "higher-is-worse";
export type Tone = "pos" | "neg" | "flat";

/** Drops missing values and sorts by date. */
export function clean(obs: Obs[]): Point[] {
    return obs
        .filter((o): o is Point => o.value !== null && Number.isFinite(o.value))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Scores a value against two thresholds.
 * lower-is-worse:  value < bad → bad, value < watch → watch, otherwise good.
 * higher-is-worse: value ≥ bad → bad, value ≥ watch → watch, otherwise good.
 */
export function band(value: number, t: { bad: number; watch: number }, direction: Direction): Status {
    if (direction === "lower-is-worse") {
        if (value < t.bad) return "bad";
        if (value < t.watch) return "watch";
        return "good";
    }
    if (value >= t.bad) return "bad";
    if (value >= t.watch) return "watch";
    return "good";
}

/** Green when the change is an improvement, red when it is a deterioration. */
export function changeTone(change: number, direction: Direction): Tone {
    if (Math.abs(change) < 1e-9) return "flat";
    const improving = direction === "lower-is-worse" ? change > 0 : change < 0;
    return improving ? "pos" : "neg";
}

/** Last observation in each calendar month (input must be sorted). */
export function monthlyLast(points: Point[]): Point[] {
    const byMonth = new Map<string, Point>();
    for (const p of points) byMonth.set(p.date.slice(0, 7), p);
    return [...byMonth.values()];
}

/** The latest point on or before a date (input must be sorted). Binary search, so long daily series stay fast. */
export function valueOnOrBefore(points: Point[], date: string): Point | undefined {
    let lo = 0;
    let hi = points.length - 1;
    let found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (points[mid].date <= date) {
            found = mid;
            lo = mid + 1;
        } else hi = mid - 1;
    }
    return found >= 0 ? points[found] : undefined;
}

export function daysBetween(a: string, b: string): number {
    return Math.abs(Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;
}

/** True if any value since a date fell below a threshold, for example a curve that was recently inverted. */
export function recentlyBelow(points: Point[], since: string, threshold: number): boolean {
    return points.some((p) => p.date >= since && p.value < threshold);
}

/** Recession pattern from how many of the NBER-style measures are falling. */
export function confirmationLevel(falling: number): { status: Status; label: string } {
    if (falling >= 3) return { status: "bad", label: "Recession pattern" };
    if (falling === 2) return { status: "watch", label: "Two falling" };
    return { status: "good", label: "Not signalled" };
}

function iso(d: Date) {
    return d.toISOString().slice(0, 10);
}

/** Shifts a YYYY-MM-DD date by whole months, clamping the day to the target month's length. */
export function shiftMonths(date: string, months: number): string {
    const [y, m, d] = date.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1 + months, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(d, lastDay));
    return iso(first);
}

export function shiftDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return iso(d);
}

/**
 * Percent change from a year earlier. Works for daily and weekly series too: it compares with the
 * latest point on or before the same date last year, if that point is within `maxGapDays`.
 */
export function yoyPct(points: Point[], maxGapDays = 31): Point[] {
    const out: Point[] = [];
    for (const p of points) {
        const target = shiftMonths(p.date, -12);
        const prev = valueOnOrBefore(points, target);
        if (!prev || prev.value === 0 || daysBetween(prev.date, target) > maxGapDays) continue;
        out.push({ date: p.date, value: (p.value / prev.value - 1) * 100 });
    }
    return out;
}

/** Period-to-period change. */
export function diffs(points: Point[]): Point[] {
    const out: Point[] = [];
    for (let i = 1; i < points.length; i++) out.push({ date: points[i].date, value: points[i].value - points[i - 1].value });
    return out;
}

export function mean(values: number[]): number {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
}

/** Every nth point plus the last one, to keep chart payloads small. */
export function thin(points: Point[], every: number): Point[] {
    if (every <= 1) return points;
    const out = points.filter((_, i) => i % every === 0);
    const last = points[points.length - 1];
    if (last && out[out.length - 1] !== last) out.push(last);
    return out;
}

/** Turns NBER's 0/1 recession indicator into [start, end] month ranges. */
export function recessionPeriods(usrec: Point[]): { start: string; end: string }[] {
    const periods: { start: string; end: string }[] = [];
    let start: string | null = null;
    let prevDate: string | null = null;
    for (const p of usrec) {
        if (p.value >= 1 && start === null) start = p.date;
        if (p.value < 1 && start !== null) {
            periods.push({ start, end: prevDate ?? start });
            start = null;
        }
        prevDate = p.date;
    }
    if (start !== null && prevDate) periods.push({ start, end: prevDate });
    return periods;
}

/** Headline label for the Chauvet–Piger recession probability (0–100). */
export function recessionLevel(probability: number): { status: Status; label: string } {
    if (probability >= 50) return { status: "bad", label: "High" };
    if (probability >= 10) return { status: "watch", label: "Elevated" };
    return { status: "good", label: "Low" };
}

/** Policy stance from the change in the upper target over the past 12 months. */
export function fedStance(change12m: number): { status: Status; label: string } {
    if (change12m > 0.25) return { status: "watch", label: "Tightening" };
    if (change12m < -0.25) return { status: "good", label: "Easing" };
    return { status: "good", label: "Holding" };
}

// ---- Formatting ------------------------------------------------------------------------------

const MINUS = "−";

/** "+0.67" / "−0.20" with a true minus sign. */
export function signed(n: number, digits: number): string {
    const s = Math.abs(n).toFixed(digits);
    if (Number(s) === 0) return (0).toFixed(digits);
    return (n < 0 ? MINUS : "+") + s;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatAsOf(date: string, frequency: string): string {
    const [y, m, d] = date.split("-").map(Number);
    const f = frequency.toUpperCase();
    if (f.startsWith("Q")) return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
    if (f.startsWith("M")) return `${MONTHS[m - 1]} ${y}`;
    if (f.startsWith("W")) return `w/e ${d} ${MONTHS[m - 1]} ${y}`;
    return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatMonth(date: string): string {
    const [y, m] = date.split("-").map(Number);
    return `${MONTHS[m - 1]} ${y}`;
}
