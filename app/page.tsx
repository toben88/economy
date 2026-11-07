import ChartBoundary from "@/components/ChartBoundary";
import Gauge from "@/components/Gauge";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import TileGroups from "@/components/TileGroups";
import YieldCurveChart from "@/components/YieldCurveChart";
import { getOverview } from "@/lib/dashboard";

// Read SQLite on every request, so a new daily update shows immediately
export const dynamic = "force-dynamic";

export default function Home() {
    const d = getOverview();
    const scored = d.counts.good + d.counts.watch + d.counts.bad;

    return (
        <div className="wrap">
            <SiteHeader active="/" updatedAt={d.updatedAt} />

            <h1>US Economic Outlook</h1>
            <p className="lede">
                The indicators with the best record of signalling where the US economy is heading. Leading indicators turn
                first, financial conditions and labor confirm, and inflation and policy set the backdrop. Updated daily from
                FRED. More indicators are on the <a href="/labor">Labor</a>, <a href="/credit">Credit</a> and{" "}
                <a href="/activity">Activity</a> pages.
            </p>

            {!d.hasData ? (
                <p className="empty">Collecting the first data from FRED. Refresh in a minute.</p>
            ) : (
                <>
                    <section className="summary" aria-label="Summary">
                        <div className="panel">
                            <h2>Recession probability</h2>
                            {d.recession ? (
                                <div className="risk">
                                    <Gauge value={d.recession.probability} status={d.recession.status} />
                                    <div>
                                        <div className="risk-num">
                                            {d.recession.probability < 10
                                                ? d.recession.probability.toFixed(1)
                                                : d.recession.probability.toFixed(0)}
                                            %
                                        </div>
                                        <div className={`risk-label ${d.recession.status}`}>{d.recession.label}</div>
                                    </div>
                                    <p className="risk-copy">
                                        Probability that the US economy is in recession now, from the Chauvet–Piger model of
                                        employment, production, income and sales. It reads near zero in expansions and jumps
                                        once a downturn has begun.
                                        <span className="risk-asof">
                                            As of {d.recession.asOf} · published with about a two-month lag · FRED
                                            RECPROUSM156N
                                        </span>
                                    </p>
                                </div>
                            ) : (
                                <p className="risk-copy">No data yet.</p>
                            )}
                        </div>
                        <div className="panel">
                            <h2>Warning signals</h2>
                            <div className="board">
                                <div className="board-cell good">
                                    <div className="board-n">{d.counts.good}</div>
                                    <div className="board-t">Healthy</div>
                                </div>
                                <div className="board-cell watch">
                                    <div className="board-n">{d.counts.watch}</div>
                                    <div className="board-t">Watch</div>
                                </div>
                                <div className="board-cell bad">
                                    <div className="board-n">{d.counts.bad}</div>
                                    <div className="board-t">Warning</div>
                                </div>
                            </div>
                            <p className="board-note">
                                <strong>
                                    {d.counts.bad} of {scored}
                                </strong>{" "}
                                indicators on this page are in warning territory
                                {d.warnings.length ? `: ${d.warnings.join(", ")}.` : "."} Forward-looking, but a count of
                                rule-based signals, not a probability.
                            </p>
                        </div>
                    </section>

                    <section className="panel confirm" aria-label="Recession confirmation">
                        <div className="confirm-head">
                            <div>
                                <h2>Is it here yet?</h2>
                                <p>
                                    The four measures the committee that dates US recessions watches most closely. Two or
                                    more falling over three months is how a recession usually shows up in the data.
                                </p>
                            </div>
                            <span className={`pill ${d.confirmation.status}`}>
                                {d.confirmation.falling} of 4 falling · {d.confirmation.label}
                            </span>
                        </div>
                        <div className="confirm-grid">
                            {d.confirmation.items.map((i) => (
                                <div className="confirm-item" key={i.name}>
                                    <div className="confirm-name">{i.name}</div>
                                    <div className={`confirm-chg ${i.falling === null ? "flat" : i.falling ? "neg" : "pos"}`}>
                                        {i.falling === null ? "" : i.falling ? "▼ " : "▲ "}
                                        {i.change}
                                    </div>
                                    <div className="confirm-meta">
                                        {i.asOf} · {i.source}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="panel feature" aria-label="Yield curve chart">
                        <ChartBoundary>
                            <YieldCurveChart points={d.curve.points} recessions={d.curve.recessions}>
                                <h3>Yield curve: 10-year minus 3-month Treasury</h3>
                                <p>
                                    The most reliable single recession predictor. An inversion (below zero) has preceded each
                                    of the last eight US recessions, typically by 6 to 18 months.
                                </p>
                            </YieldCurveChart>
                        </ChartBoundary>
                        <div className="legend">
                            <span>
                                <i style={{ background: "var(--brand)" }} />
                                Spread (percentage points)
                            </span>
                            <span>
                                <i style={{ background: "var(--down)" }} />
                                Inverted, below zero
                            </span>
                            <span>
                                <i style={{ background: "var(--hover)" }} />
                                NBER recession
                            </span>
                        </div>
                    </section>

                    <TileGroups groups={d.groups} />
                </>
            )}

            <SiteFooter />
        </div>
    );
}
