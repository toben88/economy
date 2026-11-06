import ChartBoundary from "@/components/ChartBoundary";
import Gauge from "@/components/Gauge";
import Sparkline from "@/components/Sparkline";
import YieldCurveChart from "@/components/YieldCurveChart";
import { getDashboard } from "@/lib/dashboard";

// Read SQLite on every request, so a new daily update shows immediately
export const dynamic = "force-dynamic";

const STOCKS_URL = "https://london.ftp.sh/dashboard";

function formatUpdated(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
    });
}

export default function Home() {
    const d = getDashboard();
    const scored = d.counts.good + d.counts.watch + d.counts.bad;

    return (
        <div className="wrap">
            <header className="top">
                <a className="logo" href="/">
                    <span className="logo-mark">B</span>Box In Stock
                </a>
                <div className="top-right">
                    {d.updatedAt && <span className="fresh">Updated {formatUpdated(d.updatedAt)}</span>}
                    <a className="nav-link" href={STOCKS_URL}>
                        Stocks ↗
                    </a>
                </div>
            </header>

            <h1>US Economic Outlook</h1>
            <p className="lede">
                The indicators with the best record of signalling where the US economy is heading. Leading indicators turn
                first, labor and growth confirm, and inflation and policy set the backdrop. Updated daily from FRED.
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
                                indicators are in warning territory
                                {d.warnings.length ? `: ${d.warnings.join(", ")}.` : "."} Forward-looking, but a count of
                                rule-based signals, not a probability.
                            </p>
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

                    {d.groups.map((g) => (
                        <section className="group" key={g.id}>
                            <div className="group-head">
                                <h3>{g.title}</h3>
                                <span>{g.note}</span>
                            </div>
                            <div className="grid">
                                {g.tiles.map((t) => (
                                    <article className="tile" key={t.id}>
                                        <div className="tile-top">
                                            <div>
                                                <div className="tile-name">{t.name}</div>
                                                {t.asOf && <div className="tile-asof">{t.asOf}</div>}
                                            </div>
                                            <span className={`pill ${t.status}`}>{t.label}</span>
                                        </div>
                                        <div className="tile-val">
                                            <span className="val">{t.value}</span>
                                            <span className="unit">{t.unit}</span>
                                            {t.change && <span className={`chg ${t.tone}`}>{t.change}</span>}
                                        </div>
                                        <Sparkline data={t.spark} status={t.status} />
                                        <p className="why">{t.why}</p>
                                        <div className="meta">
                                            <span>{t.lead}</span>
                                            <span>{t.source}</span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ))}
                </>
            )}

            <footer>
                <p>
                    Data from FRED, Federal Reserve Bank of St. Louis, and the original sources: BLS, BEA, the Federal
                    Reserve Board, the University of Michigan, ICE Data Indices, the Philadelphia and Chicago Feds, and
                    Chauvet and Piger. Warning thresholds are this site&apos;s own rules of thumb.
                </p>
                <p>This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.</p>
                <p>Not investment advice.</p>
            </footer>
        </div>
    );
}
