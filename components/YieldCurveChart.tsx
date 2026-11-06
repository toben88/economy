"use client";
// Interactive 10-year minus 3-month spread with NBER recessions shaded.
import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
    GridComponent,
    MarkAreaComponent,
    MarkLineComponent,
    TooltipComponent,
    VisualMapComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

echarts.use([LineChart, GridComponent, TooltipComponent, MarkAreaComponent, MarkLineComponent, VisualMapComponent, SVGRenderer]);

// ECharts needs plain colours, so these are sRGB equivalents of the page's oklch tokens.
const C = {
    brand: "#4fd1bd",
    down: "#f07a6e",
    downSoft: "rgba(240, 122, 110, 0.18)",
    recession: "rgba(255, 255, 255, 0.06)",
    line: "#3b3a36",
    lineStrong: "#4f4d48",
    faint: "#8f8c84",
    text: "#f1efea",
    card: "#2a2926",
};

const RANGES = [
    { label: "2Y", years: 2 },
    { label: "5Y", years: 5 },
    { label: "10Y", years: 10 },
];

type Props = {
    points: [string, number][];
    recessions: { start: string; end: string }[];
    /** Heading and description, shown beside the range buttons. */
    children: React.ReactNode;
};

export default function YieldCurveChart({ points, recessions, children }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const chart = useRef<echarts.ECharts | null>(null);
    const [years, setYears] = useState(5);

    const visible = useMemo(() => {
        const last = points[points.length - 1]?.[0];
        if (!last) return [];
        const d = new Date(`${last}T00:00:00Z`);
        d.setUTCFullYear(d.getUTCFullYear() - years);
        const from = d.toISOString().slice(0, 10);
        return points.filter(([date]) => date >= from);
    }, [points, years]);

    useEffect(() => {
        if (!ref.current) return;
        chart.current = echarts.init(ref.current, undefined, { renderer: "svg" });
        const observer = new ResizeObserver(() => chart.current?.resize());
        observer.observe(ref.current);
        return () => {
            observer.disconnect();
            chart.current?.dispose();
            chart.current = null;
        };
    }, []);

    useEffect(() => {
        if (!chart.current || !visible.length) return;
        const from = visible[0][0];
        const shaded = recessions
            .filter((r) => r.end >= from)
            .map((r) => [{ xAxis: r.start < from ? from : r.start }, { xAxis: r.end }]);
        chart.current.setOption(
            {
                animation: false,
                grid: { left: 44, right: 12, top: 12, bottom: 28 },
                tooltip: {
                    trigger: "axis",
                    backgroundColor: C.card,
                    borderColor: C.lineStrong,
                    textStyle: { color: C.text, fontFamily: "IBM Plex Mono, monospace", fontSize: 12 },
                    valueFormatter: (v: unknown) => `${Number(v).toFixed(2)} pp`,
                },
                xAxis: {
                    type: "time",
                    axisLine: { lineStyle: { color: C.lineStrong } },
                    axisLabel: { color: C.faint, fontFamily: "IBM Plex Mono, monospace", fontSize: 11 },
                    splitLine: { show: false },
                },
                yAxis: {
                    type: "value",
                    axisLabel: { color: C.faint, fontFamily: "IBM Plex Mono, monospace", fontSize: 11, formatter: (v: number) => v.toFixed(1) },
                    splitLine: { lineStyle: { color: C.line } },
                },
                visualMap: {
                    show: false,
                    dimension: 1,
                    pieces: [
                        { lte: 0, color: C.down },
                        { gt: 0, color: C.brand },
                    ],
                },
                series: [
                    {
                        type: "line",
                        name: "Spread",
                        data: visible,
                        showSymbol: false,
                        lineStyle: { width: 2 },
                        areaStyle: { origin: 0, opacity: 0.16 },
                        markLine: {
                            silent: true,
                            symbol: "none",
                            label: { show: false },
                            lineStyle: { color: C.lineStrong, type: "solid", width: 1.5 },
                            data: [{ yAxis: 0 }],
                        },
                        markArea: { silent: true, itemStyle: { color: C.recession }, data: shaded },
                    },
                ],
            },
            true,
        );
    }, [visible, recessions]);

    return (
        <>
            <div className="feature-head">
                <div>{children}</div>
                <div className="range" role="group" aria-label="Time range">
                    {RANGES.map((r) => (
                        <button key={r.label} type="button" aria-pressed={years === r.years} onClick={() => setYears(r.years)}>
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>
            <div ref={ref} className="chart" role="img" aria-label="Yield curve spread over time" />
        </>
    );
}
