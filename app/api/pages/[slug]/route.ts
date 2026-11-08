// GET /api/pages/labor | credit | activity: one detail page as JSON (see DetailPage in lib/pages.ts).
// GET /api/pages/index lists the available pages.
import { API_VERSION, apiJson } from "@/lib/api";
import { NAV } from "@/lib/indicators";
import { DETAIL_SLUGS, getDetailPage } from "@/lib/pages";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    if (slug === "index") {
        return apiJson({ apiVersion: API_VERSION, pages: NAV.filter((n) => DETAIL_SLUGS.includes(n.href.slice(1))) });
    }
    const page = getDetailPage(slug);
    if (!page) return apiJson({ error: "not found" }, 404);
    return apiJson({ apiVersion: API_VERSION, ...page });
}
