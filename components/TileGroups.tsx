import Sparkline from "@/components/Sparkline";
import type { Group } from "@/lib/dashboard";

export default function TileGroups({ groups }: { groups: Group[] }) {
    return (
        <>
            {groups.map((g) => (
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
    );
}
