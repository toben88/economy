import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
    title: "US Economic Outlook · Box In Stock",
    description:
        "Live dashboard of the indicators that best predict the US economy: recession probability, the yield curve, jobless claims, credit spreads, the Sahm rule and more.",
};

export const viewport: Viewport = { themeColor: "#1c1b19", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
        </html>
    );
}
