"""Latency check for SRS NFR-01 (a typical recommendation should return in under 2 seconds).

Builds a separate database with synthetic data at a larger scale, then times the ranking query and the
maintenance jobs. Synthetic data is random, so absolute numbers depend on this machine; what matters is the order
of magnitude and that the ranking query reads precomputed evidence instead of scanning raw visits.

    python3 bench.py [links] [evidence_rows]        defaults: 20000 links, 200000 visits
"""
import os
import statistics
import subprocess
import sys
import time

import psycopg2

HERE = os.path.dirname(os.path.abspath(__file__))
LINKS = int(sys.argv[1]) if len(sys.argv) > 1 else 20000
EVID = int(sys.argv[2]) if len(sys.argv) > 2 else 200000
PSQL = ["psql", "-h", "/tmp", "-p", "5433", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"]

subprocess.run(PSQL + ["-d", "postgres", "-c", "DROP DATABASE IF EXISTS govlinks_bench", "-c", "CREATE DATABASE govlinks_bench"],
               check=True, stderr=subprocess.DEVNULL)
for f in ("01_schema.sql", "02_ranking.sql", "03_seed.sql"):
    subprocess.run(PSQL + ["-d", "govlinks_bench", "-f", os.path.join(HERE, "sql", f)], check=True)
conn = psycopg2.connect("host=/tmp port=5433 user=postgres dbname=govlinks_bench")
cur = conn.cursor()


def timed(label, sql, params=None):
    t = time.perf_counter()
    cur.execute(sql, params)
    dt = time.perf_counter() - t
    print(f"  {label:<52} {dt:8.2f} s")
    return dt


print(f"Generating {LINKS:,} links and {EVID:,} visits (plus votes and feedback)")
t0 = time.perf_counter()
cur.execute("""INSERT INTO districts(state_id, district_name)
               SELECT s.state_id, 'D' || g FROM states s, generate_series(1, 50) g""")
cur.execute("INSERT INTO local_bodies(district_id, body_type, body_name) SELECT district_id, 'municipality', 'LB-' || district_id FROM districts")
cur.execute("INSERT INTO wards(local_body_id, ward_number) SELECT local_body_id, 'W' || g FROM local_bodies, generate_series(1, 20) g")
sites = max(LINKS // 20, 1)
cur.execute("""INSERT INTO websites(website_name, domain, base_url, website_type, official_status, last_verified_at, is_demo)
               SELECT 'Site ' || g, 'site' || g || '.gov.in', 'https://site' || g || '.gov.in/', 'municipal', g %% 3 > 0,
                      now() - (g %% 200) * interval '1 day', true FROM generate_series(1, %s) g""", (sites,))
cur.execute("""INSERT INTO website_locations(website_id, local_body_id)
               SELECT w.website_id, (SELECT local_body_id FROM local_bodies ORDER BY local_body_id OFFSET (w.website_id % 100) LIMIT 1)
               FROM websites w WHERE w.domain LIKE 'site%'""")
cur.execute("INSERT INTO website_locations(website_id, state_id) SELECT website_id, (SELECT min(state_id) FROM states) FROM websites WHERE domain ~ '^site[0-9]*0\\.gov\\.in$'")
cur.execute("SELECT array_agg(category_id) FROM problem_categories")
cats = cur.fetchone()[0]
cur.execute("""INSERT INTO website_links(website_id, category_id, title, url, action, link_type, trust_label, state, last_verified_at)
               SELECT w.website_id, (%s::bigint[])[1 + (g * 7 + w.website_id) %% array_length(%s::bigint[], 1)],
                      'Service ' || g, 'https://' || w.domain || '/p' || g, 'file_complaint', 'direct_form', 'PLATFORM_VERIFIED', 'verified',
                      now() - (g %% 60) * interval '1 day'
               FROM websites w, generate_series(1, 20) g WHERE w.domain LIKE 'site%%'""", (cats, cats))
cur.execute("""INSERT INTO users(email, password_hash, created_at)
               SELECT 'b' || g || '@bench.test', 'x', now() - interval '120 days' FROM generate_series(1, 5000) g""")
cur.execute("""INSERT INTO user_queries(user_id, query_text, district_id, created_at)
               SELECT 1 + (g %% 5000), 'bench', (SELECT district_id FROM districts ORDER BY district_id OFFSET (g %% 100) LIMIT 1),
                      now() - (g %% 90) * interval '1 day' FROM generate_series(1, %s) g""", (EVID,))
cur.execute("SELECT count(*) FROM website_links")
nlinks = cur.fetchone()[0]
cur.execute("""INSERT INTO website_sessions(user_id, query_id, website_id, started_at)
               SELECT q.user_id, q.query_id, l.website_id, q.created_at
               FROM user_queries q JOIN website_links l ON l.link_id = 1 + (q.query_id * 31) %% %s""", (nlinks,))
cur.execute("""INSERT INTO link_visits(session_id, link_id, opened_at, success_signal)
               SELECT s.session_id, 1 + (s.query_id * 31) %% %s, s.started_at,
                      CASE WHEN s.query_id %% 10 < 7 THEN 'success' WHEN s.query_id %% 10 < 9 THEN 'failed' ELSE 'unknown' END
               FROM website_sessions s""", (nlinks,))
cur.execute("""INSERT INTO website_votes(user_id, website_id, link_id, query_id, vote, created_at)
               SELECT q.user_id, l.website_id, l.link_id, q.query_id, CASE WHEN q.query_id %% 4 = 0 THEN -1 ELSE 1 END, q.created_at
               FROM user_queries q JOIN website_links l ON l.link_id = 1 + (q.query_id * 17) %% %s
               WHERE q.query_id %% 4 = 1""", (nlinks,))
cur.execute("ANALYZE")
conn.commit()
cur.execute("SELECT (SELECT count(*) FROM website_links), (SELECT count(*) FROM link_visits), (SELECT count(*) FROM website_votes), (SELECT count(*) FROM website_locations)")
print("  rows: links=%s visits=%s votes=%s website_locations=%s   (built in %.1f s)" % (*cur.fetchone(), time.perf_counter() - t0))

print("\nMaintenance jobs (run in the background, not per request)")
timed("refresh_website_ranking()  full rebuild", "SELECT refresh_website_ranking()")
conn.commit()
cur.execute("SELECT count(*) FROM website_ranking")
print(f"  website_ranking rows: {cur.fetchone()[0]:,}")
timed("refresh_website_ranking(one link)  after a new report", "SELECT refresh_website_ranking(%s)", (nlinks // 2,))
timed("refresh_link_states()  lifecycle pass over all links", "SELECT count(*) FROM refresh_link_states()")
conn.commit()

print("\nRecommendation query: rank_links() for random ward / category combinations")
cur.execute("SELECT ward_id FROM wards ORDER BY random() LIMIT 60")
wards = [r[0] for r in cur.fetchall()]
cur.execute("SELECT category_id FROM problem_categories WHERE NOT is_fallback")
cat_ids = [r[0] for r in cur.fetchall()]
lat, rows_returned = [], []
for i, w in enumerate(wards):
    cur.execute("SELECT * FROM resolve_location(%s)", (w,))
    ward, lb, dist, state = cur.fetchone()
    t = time.perf_counter()
    cur.execute("SELECT * FROM rank_links(%s,%s,%s,%s,%s,'{}',NULL,true,10)", (cat_ids[i % len(cat_ids)], state, dist, lb, ward))
    r = cur.fetchall()
    lat.append(time.perf_counter() - t)
    rows_returned.append(len(r))
lat.sort()
print(f"  {len(lat)} queries   median {statistics.median(lat) * 1000:.0f} ms   p95 {lat[int(len(lat) * 0.95) - 1] * 1000:.0f} ms   "
      f"max {lat[-1] * 1000:.0f} ms   (rows per query: {min(rows_returned)}-{max(rows_returned)})")
verdict = "within" if lat[-1] < 2 else "OVER"
print(f"  worst case is {verdict} the SRS target of 2 s (NFR-01) for the ranking step at {nlinks:,} links")
cur.execute("EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT * FROM rank_links(%s,%s,%s,%s,%s,'{}',NULL,true,10)", (cat_ids[0], state, dist, lb, ward))
sys.exit(0 if lat[-1] < 2 else 1)
