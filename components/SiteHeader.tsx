import { NAV } from "@/lib/indicators";

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

export default function SiteHeader({ active, updatedAt }: { active: string; updatedAt: string | null }) {
    return (
        <header className="top">
            <div className="top-left">
                <a className="logo" href="/">
                    <span className="logo-mark">B</span>Box In Stock
                </a>
                <nav className="nav" aria-label="Pages">
                    {NAV.map((n) => (
                        <a key={n.href} href={n.href} aria-current={n.href === active ? "page" : undefined}>
                            {n.label}
                        </a>
                    ))}
                </nav>
            </div>
            <div className="top-right">
                {updatedAt && <span className="fresh">Updated {formatUpdated(updatedAt)}</span>}
                <a className="nav-link" href={STOCKS_URL}>
                    Stocks ↗
                </a>
            </div>
        </header>
    );
}
