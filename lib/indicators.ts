// Which FRED series the site uses, and how the overview groups them.
// The per-indicator scoring rules live in lib/dashboard.ts and are listed in the README.

/** History fetched for every series. Long enough for the 10-year chart and year-over-year maths. */
export const OBS_START = "2000-01-01";

export const FRED_SERIES = [
    // Leading
    "T10Y3M", // 10-year minus 3-month Treasury spread (daily)
    "IC4WSA", // Initial jobless claims, 4-week average (weekly)
    "GACDFSA066MSFRBPHI", // Philadelphia Fed manufacturing, current activity (monthly)
    "PERMIT", // Building permits (monthly)
    "UMCSENT", // University of Michigan consumer sentiment (monthly)
    "BAMLH0A0HYM2", // ICE BofA US high-yield option-adjusted spread (daily)
    "CFNAIMA3", // Chicago Fed National Activity Index, 3-month average (monthly)
    // Labor
    "UNRATE", // Unemployment rate (monthly)
    "SAHMREALTIME", // Real-time Sahm rule (monthly)
    "PAYEMS", // Nonfarm payrolls, level (monthly)
    // Growth
    "A191RL1Q225SBEA", // Real GDP growth, annualized (quarterly)
    // Inflation and policy
    "PCEPILFE", // Core PCE price index (monthly)
    "DFEDTARL", // Fed funds target, lower bound (daily)
    "DFEDTARU", // Fed funds target, upper bound (daily)
    // Headline and chart
    "RECPROUSM156N", // Smoothed recession probability, Chauvet–Piger (monthly)
    "USREC", // NBER recession indicator, for chart shading (monthly)
] as const;

export type SeriesId = (typeof FRED_SERIES)[number];

export type GroupId = "leading" | "labor" | "growth" | "policy";

export const GROUPS: { id: GroupId; title: string; note: string }[] = [
    { id: "leading", title: "Leading indicators", note: "Turn 6–18 months before the economy does" },
    { id: "labor", title: "Labor market", note: "Confirms what leading indicators predicted" },
    { id: "growth", title: "Growth", note: "The scoreboard, reported with a lag" },
    { id: "policy", title: "Inflation and policy", note: "Sets how much room the Fed has to respond" },
];
