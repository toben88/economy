// GET /api/overview: everything the overview page shows, as JSON (see the Overview type in lib/dashboard.ts).
import { API_VERSION, apiJson } from "@/lib/api";
import { getOverview } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export function GET() {
    return apiJson({ apiVersion: API_VERSION, ...getOverview() });
}
