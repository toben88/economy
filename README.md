# Box In Stock: US Economic Outlook

A live dashboard of the indicators that best predict where the US economy is heading: the
probability of recession, the yield curve, jobless claims, credit spreads, the Sahm rule and more.
Data comes from [FRED](https://fred.stlouisfed.org/) and updates automatically every day.

**Live at [boxinstock.com](https://boxinstock.com).** The first tool in a planned suite.

## What it shows

**Headline: recession probability.** The Chauvet–Piger smoothed probability that the US is in a
recession *now* ([`RECPROUSM156N`](https://fred.stlouisfed.org/series/RECPROUSM156N)), based on
employment, industrial production, real income and sales. It reads near zero in expansions and jumps once
a downturn has begun, and it is published with a lag of about two months.

**Warning signals.** A forward-looking count of how many of the 17 overview indicators below are
in warning territory. It is a tally of this site's own rule-of-thumb thresholds, not a probability,
and it covers the overview only, so the number stays comparable over time.

**Is it here yet?** The four measures the NBER's recession-dating committee watches most closely:
payroll jobs, real income excluding transfers (`W875RX1`), real consumer spending (`PCEC96`) and
industrial production (`INDPRO`), each over three months. Two falling is *watch*; three or more is a
*recession pattern*. Leading indicators say a recession *might* come; these say whether one *is* here.

**Yield curve chart.** The 10-year minus 3-month Treasury spread over 2, 5 or 10 years, with
NBER recessions shaded ([`USREC`](https://fred.stlouisfed.org/series/USREC)).

**Indicator tiles.** Each shows the latest value, its change, a 3-year sparkline, and a status.
"y/y" means the tile is scored on the change from a year earlier rather than the level.

### Overview (counted in the warning signals)

| Group | Indicator | FRED series | Warning | Watch |
|---|---|---|---|---|
| Leading | Yield curve, 10Y–3M | `T10Y3M` | below 0 (inverted) | below 0.5 pp |
| Leading | Initial jobless claims, 4-week avg | `IC4WSA` | 260K or more | 230K or more |
| Leading | Philly Fed manufacturing | `GACDFSA066MSFRBPHI` | below −10 | below 0 |
| Leading | Building permits, y/y | `PERMIT` | below −15% | below 0% |
| Leading | Consumer sentiment | `UMCSENT` | below 55 | below 75 |
| Leading | Chicago Fed activity index, 3-mo avg | `CFNAIMA3` | below −0.70 | below 0 |
| Financial | High-yield credit spread | `BAMLH0A0HYM2` | 6 pp or more | 4.5 pp or more |
| Financial | Chicago Fed financial conditions | `NFCI` | 0 or more (tighter than average) | −0.25 or more |
| Financial | Banks tightening business-loan standards, net % | `DRTSCILM` | 30 or more | 10 or more |
| Labor | Unemployment, scored on the Sahm rule | `UNRATE`, `SAHMREALTIME` | Sahm 0.50 or more | Sahm 0.30 or more |
| Labor | Nonfarm payrolls, 3-month avg gain | `PAYEMS` | below 0 | below 100K |
| Labor | Continuing claims, y/y | `CCSA` | up 20% or more | up 10% or more |
| Labor | Temporary help jobs, y/y | `TEMPHELPS` | below −5% | below 0% |
| Growth | Real GDP growth, annualized | `A191RL1Q225SBEA` | below 0% | below 1.5% |
| Growth | Atlanta Fed GDPNow, current quarter | `GDPNOW` | below 0% | below 1.5% |
| Policy | Core PCE inflation, y/y | `PCEPILFE` | 3% or more | 2.5% or more |
| Policy | Fed funds target range | `DFEDTARL`, `DFEDTARU` | never | raised more than 0.25 pp in 12 months |

### Detail pages (scored, but not counted in the overview)

| Page | Indicator | FRED series | Warning | Watch |
|---|---|---|---|---|
| [Labor](https://boxinstock.com/labor) | Factory workweek, change over 12 months | `AWHMAN` | down 0.5 hr or more | any fall |
| Labor | Job openings, y/y | `JTSJOL` | below −15% | below 0% |
| Labor | Quits rate | `JTSQUR` | below 2.0% | below 2.3% |
| [Credit](https://boxinstock.com/credit) | St. Louis Fed financial stress | `STLFSI4` | 1 or more | 0 or more |
| Credit | Investment-grade spread, Baa minus 10-year | `BAA10Y` | 3 pp or more | 2.3 pp or more |
| Credit | Yield curve, 10Y–2Y | `T10Y2Y` | below 0 | below 0.5 pp, or positive after an inversion in the past year |
| Credit | Credit card delinquency rate | `DRCCLACBS` | 4% or more | 3% or more |
| [Activity](https://boxinstock.com/activity) | Core capital goods orders, y/y | `NEWORDER` | below −5% | below 0% |
| Activity | Housing starts, y/y | `HOUST` | below −15% | below 0% |
| Activity | Truck tonnage, y/y | `TRUCKD11` | below −5% | below 0% |
| Activity | Real retail sales, y/y | `RRSFS` | below −1% | below 1% |
| Activity | Vehicle sales, y/y | `TOTALSA` | below −10% | below 0% |
| Activity | Personal saving rate | `PSAVERT` | below 3% | below 4.5% |
| Activity | Crude oil (WTI), y/y | `DCOILWTICO` | up 50% or more | up 25% or more |
| Activity | Hamilton GDP-based recession index | `JHGDPBRINDX` | 67% or more | 33% or more |

Thresholds live in [`lib/dashboard.ts`](lib/dashboard.ts) and [`lib/pages.ts`](lib/pages.ts).
Changes are coloured green when they are an improvement and red when they are a deterioration.

**A caution on false alarms.** Several classic leading signals flashed through 2022–2025 without a
recession: the inverted yield curve, temporary help jobs, consumer sentiment and bank lending
standards. That is why the page pairs leading indicators with the confirmation panel.

## How it works

```
FRED API ──(daily, 15:00 UTC)──▶ ingest ──▶ SQLite ──▶ Next.js page ──▶ Caddy (HTTPS) ──▶ boxinstock.com
```

- **Ingest** ([`lib/ingest.ts`](lib/ingest.ts)) fetches all 39 series since 2000 (about a minute) and upserts them
  into SQLite, one transaction per series. If FRED fails for a series, the others still update and
  the last good data stays in place. It runs inside the app process
  ([`lib/scheduler.ts`](lib/scheduler.ts)): once a day at `INGEST_HOUR_UTC`, and at startup when
  the data is more than 20 hours old.
- **Storage** is one SQLite file with three `STRICT` tables (`series`, `observations`,
  `ingest_runs`), foreign keys on and WAL mode. All database code is in [`lib/db.ts`](lib/db.ts),
  and schema changes are numbered migrations in [`lib/migrations.ts`](lib/migrations.ts).
- **The page** reads SQLite on every request, so a new update shows immediately. Visitors never
  wait on FRED, and the API key never reaches the browser.
- **Backups**: after each successful update, a copy is written to `backups/economy-YYYY-MM-DD.db`
  next to the database. The newest seven are kept.

### Stack

Next.js 15 (App Router) · React 19 · TypeScript · SQLite via better-sqlite3 · Drizzle ORM ·
ECharts · Vitest · Docker (Node 22, Debian slim)

### Project layout

```
app/
  page.tsx              Overview page (server component)
  [section]/page.tsx    Detail pages: /labor, /credit, /activity
  api/health/route.ts   GET: liveness and data freshness
  api/ingest/route.ts   POST: manual update (token required, blocked from the internet)
components/             Header, footer, tile groups, gauge, sparkline, and the yield-curve chart
                        (YieldCurveChart and ChartBoundary are the only client components)
lib/
  indicators.ts         Which FRED series to fetch, and the header navigation
  dashboard.ts          Overview: tiles, confirmation panel, headline and chart data
  pages.ts              Detail pages: tiles grouped by theme
  tiles.ts              Tile shape and builders for level and year-over-year scoring
  compute.ts            Pure calculations and formatting (unit-tested)
  fred.ts               FRED API client
  db.ts, schema.ts, migrations.ts   SQLite access
  ingest.ts, scheduler.ts           Daily update
instrumentation.ts      Starts the scheduler when the server starts
tests/                  Vitest: calculations, tile scoring and the database layer
docs/mockup.html        The original static mockup, kept for reference
```

## Running it

You need Docker and a free [FRED API key](https://fredaccount.stlouisfed.org/apikeys).

```bash
git clone https://github.com/toben88/economy.git && cd economy
cp .env.example .env               # then set FRED_API_KEY and INGEST_TOKEN
docker network create web          # once; shared with the reverse proxy
docker compose up -d --build
```

The app listens on `http://127.0.0.1:3001` and loads the first data about a minute after it starts.
After adding a series to `lib/indicators.ts`, run a manual update (below) so it appears without
waiting for the next daily run.

| Variable | Required | Purpose |
|---|---|---|
| `FRED_API_KEY` | Yes | FRED API key. Without it, the page runs but never updates. |
| `INGEST_TOKEN` | For manual updates | Authorizes `POST /api/ingest`. Generate with `openssl rand -hex 32`. |
| `INGEST_HOUR_UTC` | No | Hour of the daily update, 0–23. Default `15`. |
| `DATABASE_PATH` | No | SQLite file location. Docker uses `/data/economy.db` in the `economy-data` volume. |

**Local development without Docker** needs Node 22: `npm install`, then `npm run dev`. Data goes in
`./data/economy.db`.

**Tests:** `npm test`. Type-check: `npm run typecheck`.

## JSON API

This app serves boxinstock.com. A Flutter version of the same dashboard
(`~/sites/boxinstock-flutter`) reads this API and is served at
[app.boxinstock.com](https://app.boxinstock.com), which forwards `/api/*` here; the future iOS app
will read the same endpoints.

| Endpoint | Returns |
|---|---|
| `GET /api/overview` | Everything on the overview: headline, counts, confirmation panel, tile groups, chart data (`Overview` in `lib/dashboard.ts`) |
| `GET /api/pages/<slug>` | One detail page: `labor`, `credit` or `activity` (`DetailPage` in `lib/pages.ts`); 404 otherwise |
| `GET /api/pages/index` | The list of detail pages |
| `GET /api/health` | Liveness and data freshness |

Responses include `apiVersion` (currently 1), are cacheable for five minutes and allow any origin.
Add fields freely, but rename or remove one only together with a new `apiVersion`, because the
iOS app will be in people's hands and can't be updated instantly.

## Operating it

```bash
# Update now, from the server
curl -X POST -H "Authorization: Bearer $(grep ^INGEST_TOKEN= .env | cut -d= -f2)" http://127.0.0.1:3001/api/ingest

# Freshness and logs
curl http://127.0.0.1:3001/api/health
docker logs --tail 50 economy

# Deploy a change
git pull && docker compose up -d --build

# Copy the latest backup out of the volume
docker cp economy:/data/backups ./backups
```

On the production server, Caddy terminates HTTPS and proxies `boxinstock.com` to the container as
`economy:3000` over the shared `web` network. It returns 404 for `/api/ingest` from the internet.

## Data and attribution

Data from FRED, Federal Reserve Bank of St. Louis, and the original sources, including BLS, BEA, the
Census Bureau, the Federal Reserve Board, the University of Michigan, ICE Data Indices, Moody's, the
Federal Reserve Banks of Atlanta, Chicago, Philadelphia and St. Louis, the American Trucking
Associations, EIA, Marcelle Chauvet and Jeremy Piger, and James Hamilton. Some series carry their own
copyright terms; see each series' notes on FRED.

This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.

Not investment advice.
