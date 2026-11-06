import type { Status } from "@/lib/compute";

const COLORS: Record<Status, string> = { good: "var(--up)", watch: "var(--warn)", bad: "var(--down)" };

/** Half-circle gauge for a 0–100 value. */
export default function Gauge({ value, status }: { value: number; status: Status }) {
    const filled = Math.max(0, Math.min(100, value));
    const arc = "M15 80 A60 60 0 0 1 135 80";
    return (
        <svg className="gauge" width="150" height="88" viewBox="0 0 150 88" role="img" aria-label={`Gauge at ${value} percent`}>
            <path d={arc} fill="none" stroke="var(--card)" strokeWidth={14} strokeLinecap="round" />
            <path
                d={arc}
                fill="none"
                stroke={COLORS[status]}
                strokeWidth={14}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${filled} 100`}
            />
        </svg>
    );
}
