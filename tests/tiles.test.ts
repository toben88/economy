import { describe, expect, it } from "vitest";
import { confirmationLevel, recentlyBelow, valueOnOrBefore, yoyPct, type Point } from "@/lib/compute";
import { LABELS, countStatuses, levelTile, yoyTile } from "@/lib/tiles";

const base = { id: "t", name: "Test", why: "", lead: "", source: "" };

/** Weekly points (Saturdays) from a start date with a value per week. */
function weekly(start: string, values: number[]): Point[] {
    const d = new Date(`${start}T00:00:00Z`);
    return values.map((value) => {
        const date = d.toISOString().slice(0, 10);
        d.setUTCDate(d.getUTCDate() + 7);
        return { date, value };
    });
}

describe("valueOnOrBefore (binary search)", () => {
    it("matches a linear scan on a long daily series", () => {
        const pts = Array.from({ length: 5000 }, (_, i) => {
            const d = new Date(Date.UTC(2010, 0, 1 + i));
            return { date: d.toISOString().slice(0, 10), value: i };
        });
        expect(valueOnOrBefore(pts, "2012-06-15")?.value).toBe(pts.findLast((p) => p.date <= "2012-06-15")?.value);
        expect(valueOnOrBefore(pts, "2009-12-31")).toBeUndefined();
        expect(valueOnOrBefore(pts, "2099-01-01")?.value).toBe(4999);
    });
});

describe("yoyPct on weekly data", () => {
    it("compares with the nearest week a year earlier", () => {
        const pts = weekly("2025-01-04", Array.from({ length: 60 }, (_, i) => 100 + i));
        const yoy = yoyPct(pts, 10);
        // The first point a full year after the start can be compared; earlier ones cannot
        expect(yoy[0].date >= "2026-01-03").toBe(true);
        const latest = yoy[yoy.length - 1];
        const prev = valueOnOrBefore(pts, "2025-" + latest.date.slice(5))!;
        expect(latest.value).toBeCloseTo((pts[pts.length - 1].value / prev.value - 1) * 100);
    });

    it("skips comparisons when the year-earlier point is too far away", () => {
        const pts = [
            { date: "2025-01-01", value: 100 },
            { date: "2026-03-01", value: 120 },
        ];
        expect(yoyPct(pts, 10)).toEqual([]);
    });
});

describe("recentlyBelow", () => {
    it("detects an inversion within the window", () => {
        const pts = [
            { date: "2026-01-01", value: -0.2 },
            { date: "2026-06-01", value: 0.3 },
        ];
        expect(recentlyBelow(pts, "2025-11-01", 0)).toBe(true);
        expect(recentlyBelow(pts, "2026-02-01", 0)).toBe(false);
    });
});

describe("confirmationLevel", () => {
    it("needs two falling measures to watch and three for a recession pattern", () => {
        expect(confirmationLevel(0).status).toBe("good");
        expect(confirmationLevel(1).status).toBe("good");
        expect(confirmationLevel(2)).toEqual({ status: "watch", label: "Two falling" });
        expect(confirmationLevel(3).status).toBe("bad");
        expect(confirmationLevel(4).status).toBe("bad");
    });
});

describe("levelTile", () => {
    const scoring = {
        frequency: "M",
        thresholds: { bad: 55, watch: 75 },
        direction: "lower-is-worse" as const,
        labels: LABELS("Very weak", "Weak", "Healthy"),
        format: (v: number) => v.toFixed(1),
        unit: "index",
        changeDigits: 1,
        changeSuffix: " m/m",
    };

    it("scores the latest value and shows the change from the previous one", () => {
        const t = levelTile(base, [
            { date: "2026-08-01", value: 51.7 },
            { date: "2026-09-01", value: 48.1 },
        ], scoring);
        expect(t).toMatchObject({ value: "48.1", status: "bad", label: "Very weak", change: "−3.6 m/m", tone: "neg", asOf: "Sep 2026" });
    });

    it("scales the change for display", () => {
        const t = levelTile(base, weekly("2026-10-03", [190_000, 195_000, 200_000, 205_000, 199_000]), {
            ...scoring,
            frequency: "W",
            thresholds: { bad: 260_000, watch: 230_000 },
            direction: "higher-is-worse",
            compareDays: 28,
            changeScale: 1 / 1000,
            changeUnit: "K",
            changeSuffix: " in 4 wk",
        });
        expect(t.change).toBe("+9.0K in 4 wk");
    });

    it("shows a no-data tile when the series is empty", () => {
        expect(levelTile(base, [], scoring)).toMatchObject({ status: "na", value: "—" });
    });
});

describe("yoyTile", () => {
    it("shows the level but scores the year-over-year change", () => {
        const pts = Array.from({ length: 13 }, (_, i) => ({
            date: `${i < 4 ? 2025 : 2026}-${String(((i + 8) % 12) + 1).padStart(2, "0")}-01`,
            value: i === 12 ? 90 : 100,
        }));
        const t = yoyTile(base, pts, {
            frequency: "M",
            thresholds: { bad: -5, watch: 0 },
            direction: "lower-is-worse",
            labels: LABELS("Falling fast", "Declining", "Growing"),
            format: (v) => v.toFixed(0),
            unit: "jobs",
        });
        expect(t).toMatchObject({ value: "90", change: "−10.0% y/y", status: "bad", label: "Falling fast" });
    });
});

describe("countStatuses", () => {
    it("ignores tiles without data", () => {
        const t = (status: "good" | "watch" | "bad" | "na") => ({ ...levelTile(base, [], {} as never), status });
        expect(countStatuses([t("good"), t("bad"), t("na"), t("bad")])).toEqual({ good: 1, watch: 0, bad: 2 });
    });
});
