import { describe, expect, it } from "vitest";
import {
    band,
    changeTone,
    clean,
    diffs,
    fedStance,
    formatAsOf,
    monthlyLast,
    recessionLevel,
    recessionPeriods,
    shiftMonths,
    signed,
    thin,
    valueOnOrBefore,
    yoyPct,
} from "@/lib/compute";
import { msUntilNextRun } from "@/lib/scheduler";

describe("band", () => {
    it("scores lower-is-worse values", () => {
        // Yield curve thresholds: below 0 bad, below 0.5 watch
        expect(band(-0.1, { bad: 0, watch: 0.5 }, "lower-is-worse")).toBe("bad");
        expect(band(0, { bad: 0, watch: 0.5 }, "lower-is-worse")).toBe("watch");
        expect(band(0.49, { bad: 0, watch: 0.5 }, "lower-is-worse")).toBe("watch");
        expect(band(0.5, { bad: 0, watch: 0.5 }, "lower-is-worse")).toBe("good");
    });
    it("scores higher-is-worse values, with the threshold itself counting", () => {
        // Sahm rule: 0.50 or more triggers it
        expect(band(0.5, { bad: 0.5, watch: 0.3 }, "higher-is-worse")).toBe("bad");
        expect(band(0.3, { bad: 0.5, watch: 0.3 }, "higher-is-worse")).toBe("watch");
        expect(band(0.29, { bad: 0.5, watch: 0.3 }, "higher-is-worse")).toBe("good");
    });
});

describe("changeTone", () => {
    it("is green for improvements and red for deteriorations", () => {
        expect(changeTone(0.2, "lower-is-worse")).toBe("pos");
        expect(changeTone(-0.2, "lower-is-worse")).toBe("neg");
        expect(changeTone(5000, "higher-is-worse")).toBe("neg");
        expect(changeTone(0, "higher-is-worse")).toBe("flat");
    });
});

describe("series helpers", () => {
    it("drops missing values and sorts", () => {
        expect(
            clean([
                { date: "2026-02-01", value: 2 },
                { date: "2026-01-01", value: null },
                { date: "2025-12-01", value: 1 },
            ]),
        ).toEqual([
            { date: "2025-12-01", value: 1 },
            { date: "2026-02-01", value: 2 },
        ]);
    });

    it("keeps the last value in each month", () => {
        const daily = [
            { date: "2026-01-02", value: 1 },
            { date: "2026-01-30", value: 2 },
            { date: "2026-02-02", value: 3 },
        ];
        expect(monthlyLast(daily)).toEqual([
            { date: "2026-01-30", value: 2 },
            { date: "2026-02-02", value: 3 },
        ]);
    });

    it("finds the value on or before a date", () => {
        const p = [
            { date: "2026-01-01", value: 1 },
            { date: "2026-01-08", value: 2 },
        ];
        expect(valueOnOrBefore(p, "2026-01-07")?.value).toBe(1);
        expect(valueOnOrBefore(p, "2026-01-08")?.value).toBe(2);
        expect(valueOnOrBefore(p, "2025-12-31")).toBeUndefined();
    });

    it("shifts months and clamps the day", () => {
        expect(shiftMonths("2026-03-31", -1)).toBe("2026-02-28");
        expect(shiftMonths("2026-01-15", -12)).toBe("2025-01-15");
        expect(shiftMonths("2024-02-29", 12)).toBe("2025-02-28");
    });

    it("computes year-over-year percent change", () => {
        const p = [
            { date: "2025-09-01", value: 100 },
            { date: "2026-08-01", value: 102 },
            { date: "2026-09-01", value: 103 },
        ];
        const yoy = yoyPct(p);
        expect(yoy).toHaveLength(1);
        expect(yoy[0].date).toBe("2026-09-01");
        expect(yoy[0].value).toBeCloseTo(3);
    });

    it("computes period changes, such as monthly payroll gains", () => {
        expect(
            diffs([
                { date: "2026-08-01", value: 159000 },
                { date: "2026-09-01", value: 159150 },
                { date: "2026-10-01", value: 159293 },
            ]).map((p) => p.value),
        ).toEqual([150, 143]);
    });

    it("thins a series but keeps the last point", () => {
        const p = [1, 2, 3, 4, 5].map((v, i) => ({ date: `2026-01-0${i + 1}`, value: v }));
        expect(thin(p, 2).map((x) => x.value)).toEqual([1, 3, 5]);
        expect(thin(p, 3).map((x) => x.value)).toEqual([1, 4, 5]);
    });

    it("turns NBER 0/1 months into recession periods", () => {
        const usrec = ["2020-01", "2020-02", "2020-03", "2020-04", "2020-05"].map((m, i) => ({
            date: `${m}-01`,
            value: i === 1 || i === 2 || i === 3 ? 1 : 0,
        }));
        expect(recessionPeriods(usrec)).toEqual([{ start: "2020-02-01", end: "2020-04-01" }]);
    });
});

describe("labels", () => {
    it("labels recession probability", () => {
        expect(recessionLevel(0.4)).toEqual({ status: "good", label: "Low" });
        expect(recessionLevel(10)).toEqual({ status: "watch", label: "Elevated" });
        expect(recessionLevel(80)).toEqual({ status: "bad", label: "High" });
    });
    it("labels Fed policy stance from the 12-month change", () => {
        expect(fedStance(-1).label).toBe("Easing");
        expect(fedStance(0).label).toBe("Holding");
        expect(fedStance(0.5)).toEqual({ status: "watch", label: "Tightening" });
    });
});

describe("formatting", () => {
    it("uses a true minus sign and no negative zero", () => {
        expect(signed(0.674, 2)).toBe("+0.67");
        expect(signed(-0.2, 2)).toBe("−0.20");
        expect(signed(-0.001, 2)).toBe("0.00");
    });
    it("formats as-of dates by frequency", () => {
        expect(formatAsOf("2026-07-01", "Q")).toBe("Q3 2026");
        expect(formatAsOf("2026-09-01", "M")).toBe("Sep 2026");
        expect(formatAsOf("2026-10-31", "W")).toBe("w/e 31 Oct 2026");
        expect(formatAsOf("2026-11-05", "D")).toBe("5 Nov 2026");
    });
});

describe("scheduler", () => {
    it("waits until today's run hour, or tomorrow's if it has passed", () => {
        expect(msUntilNextRun(new Date("2026-11-06T14:00:00Z"), 15)).toBe(60 * 60 * 1000);
        expect(msUntilNextRun(new Date("2026-11-06T15:00:00Z"), 15)).toBe(24 * 60 * 60 * 1000);
        expect(msUntilNextRun(new Date("2026-11-06T16:30:00Z"), 15)).toBe(22.5 * 60 * 60 * 1000);
    });
});
