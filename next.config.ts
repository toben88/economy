import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Self-contained server bundle for the Docker image
    output: "standalone",
    // Native SQLite driver: load it from node_modules at runtime instead of bundling it
    serverExternalPackages: ["better-sqlite3"],
    poweredByHeader: false,
};

export default nextConfig;
