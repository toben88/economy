// Manual update: POST with "Authorization: Bearer <INGEST_TOKEN>".
// Caddy blocks this path from the internet; call it on the server via 127.0.0.1:3001.
import { timingSafeEqual } from "node:crypto";
import { backupDatabase } from "@/lib/db";
import { runIngest } from "@/lib/ingest";

export const dynamic = "force-dynamic";

function authorized(header: string | null, token: string) {
    const given = Buffer.from(header ?? "");
    const expected = Buffer.from(`Bearer ${token}`);
    return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
    const token = process.env.INGEST_TOKEN;
    if (!token) return new Response("Not found", { status: 404 });
    if (!authorized(request.headers.get("authorization"), token)) return new Response("Unauthorized", { status: 401 });

    const result = await runIngest();
    if (result.status === "ok" || result.status === "partial") await backupDatabase();
    return Response.json(result, { status: result.status === "failed" ? 502 : 200 });
}
