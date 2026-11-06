// Liveness and data freshness, for the Docker healthcheck and quick checks.
import { getLastRun, getLastSuccessfulRun } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
    const lastRun = getLastRun();
    const lastSuccess = getLastSuccessfulRun();
    return Response.json({
        ok: true,
        lastRun: lastRun ? { status: lastRun.status, startedAt: lastRun.startedAt, finishedAt: lastRun.finishedAt } : null,
        dataUpdatedAt: lastSuccess?.finishedAt ?? null,
    });
}
