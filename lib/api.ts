// Shared response helpers for the public JSON API used by the Flutter apps.
// The data is public and changes once a day, so it is cacheable and readable from any origin.
export const API_VERSION = 1;

const HEADERS = {
    "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    "Access-Control-Allow-Origin": "*",
};

export function apiJson(body: unknown, status = 200) {
    return Response.json(body, { status, headers: HEADERS });
}
