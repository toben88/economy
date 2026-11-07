// Which FRED series the site fetches, and the site's pages.
// Scoring rules live in lib/dashboard.ts (overview) and lib/pages.ts (detail pages); the README lists them.

/** History fetched for every series. Long enough for the 10-year chart and year-over-year maths. */
export const OBS_START = "2000-01-01";

export const FRED_SERIES = [
    // ---- Overview ----
    // Leading
    "T10Y3M", // 10-year minus 3-month Treasury spread (daily)
    "IC4WSA", // Initial jobless claims, 4-week average (weekly)
    "GACDFSA066MSFRBPHI", // Philadelphia Fed manufacturing, current activity (monthly)
    "PERMIT", // Building permits (monthly)
    "UMCSENT", // University of Michigan consumer sentiment (monthly)
    "CFNAIMA3", // Chicago Fed National Activity Index, 3-month average (monthly)
    // Financial conditions
    "BAMLH0A0HYM2", // ICE BofA US high-yield option-adjusted spread (daily)
    "NFCI", // Chicago Fed National Financial Conditions Index (weekly)
    "DRTSCILM", // Banks tightening C&I loan standards, net % (quarterly)
    // Labor
    "UNRATE", // Unemployment rate (monthly)
    "SAHMREALTIME", // Real-time Sahm rule (monthly)
    "PAYEMS", // Nonfarm payrolls, level (monthly)
    "CCSA", // Continued claims (weekly)
    "TEMPHELPS", // Temporary help services employment (monthly)
    // Growth
    "A191RL1Q225SBEA", // Real GDP growth, annualized (quarterly)
    "GDPNOW", // Atlanta Fed GDPNow estimate for the current quarter
    // Inflation and policy
    "PCEPILFE", // Core PCE price index (monthly)
    "DFEDTARL", // Fed funds target, lower bound (daily)
    "DFEDTARU", // Fed funds target, upper bound (daily)
    // Headline, confirmation panel and chart
    "RECPROUSM156N", // Smoothed recession probability, Chauvet–Piger (monthly)
    "INDPRO", // Industrial production (monthly)
    "W875RX1", // Real personal income excluding transfers (monthly)
    "PCEC96", // Real personal consumption expenditures (monthly)
    "USREC", // NBER recession indicator, for chart shading (monthly)

    // ---- Labor page ----
    "AWHMAN", // Average weekly hours, manufacturing production workers (monthly)
    "JTSJOL", // Job openings (monthly)
    "JTSQUR", // Quits rate (monthly)

    // ---- Credit page ----
    "STLFSI4", // St. Louis Fed Financial Stress Index (weekly)
    "BAA10Y", // Moody's Baa corporate yield minus 10-year Treasury (daily)
    "T10Y2Y", // 10-year minus 2-year Treasury spread (daily)
    "DRCCLACBS", // Credit card delinquency rate (quarterly)

    // ---- Activity page ----
    "NEWORDER", // Core capital goods orders (monthly)
    "HOUST", // Housing starts (monthly)
    "TRUCKD11", // Truck tonnage index (monthly)
    "RRSFS", // Real retail and food services sales (monthly)
    "TOTALSA", // Total vehicle sales (monthly)
    "PSAVERT", // Personal saving rate (monthly)
    "DCOILWTICO", // WTI crude oil price (daily)
    "JHGDPBRINDX", // Hamilton GDP-based recession indicator (quarterly)
] as const;

export type SeriesId = (typeof FRED_SERIES)[number];

/** Header navigation. Detail pages are served by app/[section]/page.tsx. */
export const NAV = [
    { href: "/", label: "Overview" },
    { href: "/labor", label: "Labor" },
    { href: "/credit", label: "Credit" },
    { href: "/activity", label: "Activity" },
] as const;
