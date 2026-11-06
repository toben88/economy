import type { Status } from "@/lib/compute";

const COLORS: Record<Status | "na", string> = {
    good: "var(--up)",
    watch: "var(--warn)",
    bad: "var(--down)",
    na: "var(--faint)",
};

export default function Sparkline({ data, status }: { data: number[]; status: Status | "na" }) {
    if (data.length < 2) return <svg className="spark" aria-hidden="true" />;
    const w = 200;
    const h = 44;
    const pad = 3;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const d = data
        .map((v, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = pad + (1 - (v - min) / span) * (h - pad * 2);
            return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ");
    return (
        <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
            <path
                d={d}
                fill="none"
                stroke={COLORS[status]}
                strokeWidth={1.75}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
            />
        </svg>
    );
}
