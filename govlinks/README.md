# Government service discovery: temporary PostgreSQL build

A working prototype of the data model, link fetching and ranking logic from the SRS
"Government Service Discovery & Intelligent Website Recommendation System" (v1.0).
It answers: *which government service link is most likely to solve this problem for this location?*

Everything runs on a throwaway PostgreSQL instance and synthetic data. Nothing here talks to a real government
site except the two portals listed under "Real vs placeholder" (and only if you let the fetcher run).

## Run it

```
pip install psycopg2-binary
./start_db.sh            # throwaway PostgreSQL 16 on port 5433, data in /tmp/pgdata_govlinks
python3 demo.py          # builds the database, runs a simulated community, prints rankings, 48 checks
python3 test_api.py      # 22 checks against every API endpoint (run demo.py first)
python3 bench.py         # latency benchmark at 20,000 links / 200,000 visits (about 1 minute)
python3 api.py           # development API on 127.0.0.1:8080
python3 maintenance.py refresh | check-links | discover <website_id>
```

`start_db.sh` assumes a Debian/Ubuntu PostgreSQL install and root. On your own machine, point `GOVLINKS_DSN` at any
PostgreSQL 14+ database and load `sql/01_schema.sql`, `02_ranking.sql`, `03_seed.sql` in order.

## Layout

| Path | What it is |
|---|---|
| `sql/01_schema.sql` | Normalized schema. One generic table per concept, no per-state tables (SRS 6.1). |
| `sql/02_ranking.sql` | Ranking function, evidence aggregation, link lifecycle rules, all weights in `ranking_config`. |
| `sql/03_seed.sql` | Demo geography, taxonomy, keywords, websites and links. |
| `govlinks/fetcher.py` | Polite fetcher: allowlist, robots.txt, manual redirects, size/time limits, soft-404 detection, discovery. |
| `govlinks/recommender.py` | Query classification, recommendation, click tracking, outcomes, feedback, community-suggested links. |
| `govlinks/mock_site.py` | A fake portal on 127.0.0.1 so the fetcher can be tested without touching real sites. |
| `api.py` | Small HTTP API with the SRS paths. Development only, no authentication. |

## How a recommendation is made

1. The query is normalised and matched to a problem category with keyword weights (English and Hindi written in Latin letters).
   No confident match falls back to the general-grievance portals.
2. Location is resolved from the ward upward: ward, local body, district, state. A website's most specific scope wins.
3. Candidates are links whose category is in the problem's family (exact, child, parent, or a general portal).
   Keywords refine relevance but cannot admit a link from an unrelated category.
4. Each candidate is scored and the list is ranked:

```
score = 100 x multiplier x ( 0.30 F + 0.25 U + 0.20 R + 0.15 L + 0.10 T )
```

| Term | Meaning |
|---|---|
| F feedback | Lower confidence bound of the weighted share of positive votes and "useful" feedback |
| U usage | Same for visits with a known outcome (success vs failed, broken, wrong page) |
| R relevance | 0.7 x category closeness (exact 1.0, child 0.8, parent 0.6, general portal 0.35) + 0.3 x keyword match; x0.85 if the link's action is not the one asked for |
| L location | Ward 1.0, local body 0.85, district 0.65, state 0.45, country 0.25 |
| T trust | 0.5 official site + 0.3 how recently verified + 0.2 trust label |
| multiplier | 1.0 verified, 0.8 candidate (unconfirmed), 0.6 stale |

All weights and thresholds are rows in `ranking_config`. Each recommendation stores its component scores in
`recommendation_logs.components`, and each result carries a plain-language reason.

### How evidence is counted

- **Contextual (SRS 11.2).** F and U use only evidence from the query's district. A link that works in Jaipur gets no
  credit in Pune. Evidence with no query attached cannot be placed, so it only feeds the lifecycle rules.
- **Once per user.** A user counts once per link per district (their latest report), so repeat clicking cannot inflate a link.
- **Account maturity.** Accounts under 3 days old count for nothing; weight rises from 0.2 to 1 by day 14. Evidence is kept
  and starts counting when the account matures.
- **Time decay.** Half-life 90 days.
- **Small samples.** A prior of 4 pseudo-observations at 50% means one vote cannot dominate.
- **Dwell time is not used** as a success signal (SRS 11.2). Only explicit outcomes count.
- A single outcome report is a *usage* signal. Opinions (votes, useful, rating) are a separate signal.

### Link lifecycle (SRS 11.3)

`candidate -> verified -> stale -> retired`, recorded in `link_state_history` with a reason.

- **To verified:** at least 3 distinct established users succeeded, weighted success ratio at least 0.70, no open
  quality flags, latest health check passing.
- **To stale:** the last 2 health checks failed; or 3 or more distinct users reported broken / wrong page in 30 days
  (and more than reported success); or a verified link has had no success for 90 days.
- **Stale back to verified:** two consecutive passing checks and a user success in the last 30 days.
- **To retired:** stale for 60 days. Retired links are hidden but kept for history.
- Community-suggested links start as `USER_SUBMITTED` candidates and become `COMMUNITY_VERIFIED`, never `OFFICIAL`.
- A health check that gets no HTTP answer at all (the checker itself offline) is stored as *inconclusive* and never counts against a link.

## Fetching rules

- Only hosts on `allowed_domains` (`*.gov.in`, `*.nic.in` by default). Every redirect hop is re-checked.
- robots.txt is honoured, with a per-host delay. Cookies, logins and form submission are never used.
- One page per request, size and time limits, soft-404 detection (HTTP 200 with a "not found" page).
- Stored URLs are cleaned: query strings, fragments and session ids are removed.
- Discovery reads a portal's front page only and adds same-site links as unverified candidates.
- `/go/<link_id>` redirects only to a stored URL on an allowed host, so it cannot be used as an open redirect.

## SRS coverage

| SRS | Status |
|---|---|
| FR-02 geography, FR-03/04 departments, officials, assignments | Schema, constraints and tests. No API or admin screens. |
| FR-05/06 taxonomy and keyword mapping | Done, including the Water and Electricity trees from section 8. |
| FR-07/08/09 websites, location scope, direct links | Done. Links are separate from domains. |
| FR-10 query storage | Done: original text, detected category, keywords with confidence. |
| FR-11 controlled activity tracking | Partial. Redirect tracking, sessions, visits, previous/next link chaining and durations work. No WebView or extension. |
| FR-12 voting and feedback | Done, one vote per user per context. |
| FR-13/14 recommendation and ranking | Done, weights configurable. |
| FR-01 registration and auth | Not built. `users` has a password hash column and roles only. |
| FR-15 administration | Not built. No admin API. Weights and link states are changed in SQL. |
| FR-16 audit | Partial. Changes to a link's URL, state or status are logged. No login or security events yet. |
| NFR-01 under 2 s | Measured on synthetic data: median 29 ms, p95 46 ms, max 51 ms at 20,016 links and 200,000 visits. |
| NFR-10 localization | English plus Hindi in Latin script. No Devanagari keywords seeded. |
| 16.1 versioned migrations | Not done. The SQL files are ordered scripts, not a migration tool. |

## Real vs placeholder

- Every `*.example` domain, every helpline number and every department record is a placeholder.
- Two real portals are in the seed: Rajasthan Sampark and CPGRAMS. They are loaded as **unverified candidates** with
  URLs that I have not been able to check, because the build environment could not reach them (the health check
  reports them as inconclusive). Check both by hand before relying on them.
- The users, visits and votes in `demo.py` are simulated.

## Known limits

- The classifier is keyword matching. Replace it with a multilingual embedding or intent model (SRS 19) behind the
  same `(category, score, keywords)` interface.
- The API has no authentication. `user_id` comes from the request, so anyone can claim to be anyone.
- `refresh()` with no argument recomputes everything. It took 9.7 s at 200,000 visits, so run it as a scheduled job
  (`maintenance.py refresh`), not per request. Per-report updates touch only one link and take milliseconds.
- Benchmark data is random. Real skew (a few popular links, many empty ones) will behave differently.
- PostGIS, WebView tracking, retention policies and table partitioning from the SRS are not implemented.
