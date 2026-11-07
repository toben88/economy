// Detail pages: /labor, /credit and /activity. Unknown paths return 404.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import TileGroups from "@/components/TileGroups";
import { getDetailPage } from "@/lib/pages";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const page = getDetailPage((await params).section);
    return page ? { title: `${page.title} · Box In Stock`, description: page.intro } : {};
}

export default async function DetailPage({ params }: Props) {
    const page = getDetailPage((await params).section);
    if (!page) notFound();
    const total = page.counts.good + page.counts.watch + page.counts.bad;

    return (
        <div className="wrap">
            <SiteHeader active={`/${page.slug}`} updatedAt={page.updatedAt} />

            <h1>{page.title}</h1>
            <p className="lede">{page.intro}</p>

            <div className="page-counts" aria-label="Status of indicators on this page">
                <span className="pill good">{page.counts.good} healthy</span>
                <span className="pill watch">{page.counts.watch} watch</span>
                <span className="pill bad">{page.counts.bad} warning</span>
                <span className="page-counts-note">
                    {total} indicators, scored with the same kind of rules as the overview but not counted in its warning
                    signals. <a href="/">Back to the overview</a>
                </span>
            </div>

            <TileGroups groups={page.groups} />

            <SiteFooter />
        </div>
    );
}
