"""End-to-end demo: build the database, fetch links from a mock portal, simulate users, rank, and check the rules.

Run:  python3 demo.py
Needs a running PostgreSQL (see README). Uses only a local mock portal for web requests.
"""
import os
import random
import subprocess
import sys
from datetime import datetime, timedelta, timezone

import psycopg2
import psycopg2.errors as pgerr

from govlinks import mock_site
from govlinks.db import connect
from govlinks.fetcher import Fetcher, normalize_url
from govlinks.recommender import (Classifier, give_feedback, propose_link, record_outcome, recommend, refresh,
                                  session_of, start_visit, vote)

HERE = os.path.dirname(os.path.abspath(__file__))
PSQL = ["psql", "-h", os.environ.get("PGHOST", "/tmp"), "-p", os.environ.get("PGPORT", "5433"),
        "-U", os.environ.get("PGUSER", "postgres"), "-v", "ON_ERROR_STOP=1", "-q"]
MOCK = "http://127.0.0.1:8099"
NOW = datetime.now(timezone.utc)
random.seed(7)
checks = []


def day(n, hours=0):
    return NOW - timedelta(days=n, hours=hours)


def check(name, cond):
    checks.append((name, bool(cond)))
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}")


def table(rows, cols, widths):
    print("  " + " ".join(c.ljust(w) for c, w in zip(cols, widths)))
    print("  " + " ".join("-" * w for w in widths))
    for r in rows:
        print("  " + " ".join(str(v)[:w].ljust(w) for v, w in zip(r, widths)))


def show(result, title):
    print(f"\n{title}")
    print(f"  category: {result['category'] or 'no confident match (fallback)'}  action: {result['action']}  alternatives: {result['alternatives']}")
    rows = [(r["rank"], r["score"], r["state"], r["title"], r["website_name"].replace(" (DEMO)", "")) for r in result["results"]]
    table(rows, ["#", "score", "state", "title", "site"], [2, 6, 9, 38, 30])


def sh(db, f):
    subprocess.run(PSQL + ["-d", db, "-f", os.path.join(HERE, "sql", f)], check=True)


# ----------------------------------------------------------------- 1. database
print("1. Creating database and loading schema, ranking functions and seed data")
subprocess.run(PSQL + ["-d", "postgres", "-c", "DROP DATABASE IF EXISTS govlinks_demo", "-c", "CREATE DATABASE govlinks_demo"], check=True,
               stderr=subprocess.DEVNULL)
for f in ("01_schema.sql", "02_ranking.sql", "03_seed.sql"):
    sh("govlinks_demo", f)
conn = connect()
cur = conn.cursor()
cur.execute("SELECT (SELECT count(*) FROM states), (SELECT count(*) FROM wards), (SELECT count(*) FROM websites), "
            "(SELECT count(*) FROM website_links), (SELECT count(*) FROM keywords)")
print("   states=%s wards=%s websites=%s links=%s keywords=%s" % cur.fetchone())
cur.execute("SELECT sum(value) FROM ranking_config WHERE key LIKE 'w\\_%'")
check("ranking weights sum to 1", abs(float(cur.fetchone()[0]) - 1.0) < 1e-9)

# ----------------------------------------------------------------- 2. fetcher against the mock portal
print("\n2. Fetcher: policy tests against a local mock portal")
mock_site.start(8099)
f = Fetcher(conn, allow_demo=True, min_delay=0, timeout=1.5)
check("robots.txt disallowed path is skipped, not fetched", f.fetch_page(MOCK + "/private/data")["skipped"])
r = f.fetch_page(MOCK + "/offsite")
check("redirect to a non-allowlisted host is blocked", (not r["ok"]) and "off allowlist" in (r["error"] or ""))
check("soft 404 (HTTP 200, 'Page not found' title) is not ok", not f.fetch_page(MOCK + "/soft404")["ok"])
check("slow page times out and is reported as a failure", not f.fetch_page(MOCK + "/slow")["ok"])
r = f.fetch_page(MOCK + "/citizen/water-old")
check("301 redirect is followed and final URL recorded", r["ok"] and r["redirected"] and r["final_url"].endswith("/citizen/water"))
check("URL sanitiser removes query, fragment and session id",
      normalize_url("https://Portal.GOV.in:443/a/b/;jsessionid=XYZ?token=1#x") == "https://portal.gov.in/a/b")
check("non-government domain is refused by default", not Fetcher(conn).allowed("https://random-site.com/x"))

# point some demo links at the mock portal so real fetches happen
swap = {
    "https://jaipurmc.example/citizen/water/complaint-form": MOCK + "/jaipur/water/complaint-form",
    "https://jaipurmc.example/old/water-complaint": MOCK + "/old/water-complaint",
    "https://jaipur-water.example/grievance/new": MOCK + "/phed/grievance/new",
    "https://jaipurmc.example/citizen/sanitation/complaint": MOCK + "/sanitation/complaint",
    "https://jaipurmc.example/citizen/water": MOCK + "/citizen/water-old",
}
for old, new in swap.items():
    cur.execute("UPDATE website_links SET url=%s WHERE url=%s", (new, old))
cur.execute("UPDATE websites SET base_url=%s WHERE domain='jaipurmc.example'", (MOCK + "/",))
conn.commit()
cur.execute("SELECT link_id, url FROM website_links")
LINK = {u: i for i, u in cur.fetchall()}
A, E, P = LINK[swap["https://jaipurmc.example/citizen/water/complaint-form"]], LINK[swap["https://jaipurmc.example/old/water-complaint"]], \
    LINK[swap["https://jaipur-water.example/grievance/new"]]
cur.execute("SELECT website_id FROM websites WHERE domain='jaipurmc.example'")
JMC = cur.fetchone()[0]

print("\n3. Health checks (two rounds, two days apart) on links the fetcher is allowed to reach")
for when in (day(2), day(0, 1)):
    res = f.check_all(at=when)
done = [x for x in res if not x["skipped"]]
print(f"   checked {len(done)} links, skipped {len(res) - len(done)} (hosts not allowlisted or placeholder domains)")
table([(x["link_id"], x["status_code"], "ok" if x["ok"] else ("n/a" if x["inconclusive"] else "FAIL"), x["redirected"], (x["error"] or "")[:34]) for x in done],
      ["link", "http", "result", "redirect", "error"], [5, 5, 6, 8, 34])
check("unreachable real portals are inconclusive, not counted as failures",
      all(x["inconclusive"] for x in done if x["status_code"] is None) and any(x["status_code"] is None for x in done))
check("dead link (404) was recorded as failed", any(x["link_id"] == E and not x["ok"] for x in done))
check("redirecting landing page counts as working", any(x["redirected"] and x["ok"] for x in done))

print("\n4. Discovery: read the portal front page and add candidate links")
clf = Classifier(conn)
d = f.discover_links(JMC, clf)
table([(a["link_id"], a["category"], a["score"], a["url"]) for a in d["added"]], ["link", "category", "score", "url"], [5, 20, 6, 45])
check("discovery added same-site links only, as unverified candidates", len(d["added"]) == 2)
cur.execute("SELECT count(*) FROM website_links WHERE source='crawler' AND state='candidate' AND trust_label='UNVERIFIED'")
check("crawler links are stored as UNVERIFIED candidates", cur.fetchone()[0] == 2)

# ----------------------------------------------------------------- 5. baseline
QUERY = "nal mein paani nahi aa raha, water supply problem"
cur.execute("SELECT ward_id FROM wards w JOIN local_bodies lb USING (local_body_id) WHERE lb.body_name LIKE 'Jaipur%' AND ward_number='24'")
W24 = cur.fetchone()[0]
cur.execute("SELECT ward_id FROM wards w JOIN local_bodies lb USING (local_body_id) WHERE lb.body_name LIKE 'Pune%'")
W7 = cur.fetchone()[0]
refresh(conn)
base = recommend(conn, QUERY, ward_id=W24, limit=8, clf=clf)
show(base, "5. BEFORE any user activity (Jaipur ward 24)")

# ----------------------------------------------------------------- 6. simulate users and outcomes
print("\n6. Simulating users and outcomes (chronological). Every user's activity is tied to a query made in their district.")
cur.execute("SELECT district_id FROM districts WHERE district_name='Jaipur'")
JAIPUR = cur.fetchone()[0]
cur.execute("SELECT district_id FROM districts WHERE district_name='Pune'")
PUNE = cur.fetchone()[0]
users, uq = {}, {}


def new_user(name, created):
    cur.execute("INSERT INTO users(email,password_hash,created_at) VALUES (%s,'x',%s) RETURNING user_id", (f"{name}@demo.test", created))
    uid = cur.fetchone()[0]
    cur.execute("INSERT INTO user_queries(user_id, query_text, district_id, created_at) VALUES (%s,'water supply problem',%s,%s) RETURNING query_id",
                (uid, JAIPUR, created))
    uq[uid] = cur.fetchone()[0]
    return uid


for i in range(1, 41):
    users[f"u{i}"] = new_user(f"user{i}", day(120))
for i in range(1, 13):
    users[f"s{i}"] = new_user(f"new{i}", day(1))
conn.commit()
est = [users[f"u{i}"] for i in range(1, 41)]
sybil = [users[f"s{i}"] for i in range(1, 13)]
N = LINK["https://jal-national.example/report"]


def visit(u, link, when, outcome, final=None):
    vid, _ = start_visit(conn, u, link, query_id=uq[u], at=when - timedelta(minutes=4))
    return record_outcome(conn, vid, outcome, "final_url" if final else "none", final, final_url=final, at=when, allow_demo=True)


events = []   # (time, user, link, outcome, final_url)
for k, u in enumerate(est[0:16]):                                   # P: reliable
    events.append((day(35 - k * 2, random.randint(0, 20)), u, P, "success" if k not in (4, 11) else "failed", None))
for k, u in enumerate(est[16:26]):                                  # A: works for half, others land on the wrong form
    events.append((day(30 - k * 2, random.randint(0, 20)), u, A, "success" if k % 2 == 0 else "wrong_page", None))
for k, u in enumerate(est[26:29]):                                  # E: worked long ago
    events.append((day(70 - k * 4), u, E, "success", None))
for k, u in enumerate(est[29:33]):                                  # E: broken recently
    events.append((day(9 - k * 2, 3), u, E, "broken", None))
for k, u in enumerate(est[33:39]):                                  # N (national portal): works for Jaipur residents
    events.append((day(14 - k, 2), u, N, "success", None))
NEWPATH = MOCK + "/portal/water/new-complaint?session=abc123#form"   # note the query string a user would paste
events.append((day(20), est[0], A, "success", NEWPATH))             # u1 reports the deeper page they ended on
events.sort(key=lambda e: e[0])

cand_id = None
for when, u, link, outcome, final in events:
    out = visit(u, link, when, outcome, final)
    if out["proposed"] and out["proposed"][0]:
        cand_id = out["proposed"][0]
        print(f"   u1 proposed a deeper page -> link {cand_id}: {out['proposed'][1]} (stored without the query string)")
cur.execute("SELECT url FROM website_links WHERE link_id=%s", (cand_id,))
check("proposed URL was cleaned before saving", cur.fetchone()[0] == MOCK + "/portal/water/new-complaint")

for k, u in enumerate(est[33:38]):                                   # candidate C used by other independent users
    when = day(8 - k, 5)
    vid, _ = start_visit(conn, u, cand_id, query_id=uq[u], at=when - timedelta(minutes=3))
    record_outcome(conn, vid, "success", at=when)
f.check_link(cand_id, at=day(0, 2))
refresh(conn)

# sybil attempt: one brand-new account proposes a shortcut, a dozen new accounts praise it
s_id, _ = propose_link(conn, A, MOCK + "/portal/water/shortcut", sybil[0], allow_demo=True, at=day(0, 20))
for k, u in enumerate(sybil):
    when = day(0, 19 - k)
    vid, _ = start_visit(conn, u, s_id, query_id=uq[u], at=when - timedelta(minutes=2))
    record_outcome(conn, vid, "success", at=when)
    vote(conn, u, s_id, 1, query_id=uq[u], at=when)
f.check_link(s_id, at=day(0, 1))
refresh(conn)

# explicit opinions are a separate signal from outcomes: votes and useful / not useful feedback
for u in est[0:8]:
    vote(conn, u, P, 1, query_id=uq[u], at=day(10))
for u in est[8:12]:
    give_feedback(conn, u, P, uq[u], useful=True, rating=5, at=day(9))
for u in est[16:19]:
    vote(conn, u, A, 1, query_id=uq[u], at=day(10))
for u in est[19:22]:
    vote(conn, u, A, -1, query_id=uq[u], at=day(10))
vote(conn, est[0], P, 1, query_id=uq[est[0]], at=day(9))             # duplicate vote from the same user
cur.execute("SELECT count(*) FROM website_votes WHERE user_id=%s AND link_id=%s", (est[0], P))
check("one vote per user per link (duplicate overwritten, not added)", cur.fetchone()[0] == 1)
refresh(conn)

cur.execute("SELECT count(*) FROM link_visits")
nv = cur.fetchone()[0]
cur.execute("SELECT count(*) FROM link_feedback")
print(f"   {nv} link visits and {cur.fetchone()[0]} feedback records written")

# ----------------------------------------------------------------- 7. results
after = recommend(conn, QUERY, ward_id=W24, limit=8, clf=clf)
show(after, "7. AFTER user activity (Jaipur ward 24)")
ranks = {r["link_id"]: r for r in after["results"]}

print("\n   Score breakdown (each component 0..1, weights 30/25/20/15/10):")
table([(r["link_id"], r["title"][:34], r["c_feedback"], r["c_usage"], r["c_relevance"], r["c_location"], r["c_trust"], r["multiplier"])
       for r in after["results"]], ["link", "title", "feedback", "usage", "relevance", "location", "trust", "x"], [5, 34, 8, 6, 9, 8, 6, 5])
print("\n   Why the top result:", after["results"][0]["reason"])

cur.execute("SELECT link_id, old_state, new_state, reason FROM link_state_history ORDER BY changed_at, history_id")
print("\n   Link lifecycle changes:")
table(cur.fetchall(), ["link", "from", "to", "reason"], [5, 10, 9, 60])
cur.execute("SELECT link_id, state, trust_label FROM website_links WHERE link_id = ANY(%s)", ([A, E, P, cand_id, s_id],))
st = {r[0]: (r[1], r[2]) for r in cur.fetchall()}

print("\n8. Checks")
check("most reliable link (14/16 successes plus positive feedback) ranks first", after["results"][0]["link_id"] == P)
check("dead link is marked stale", st[E][0] == "stale")
check("stale link ranks below the working municipal form", E not in ranks or ranks[E]["rank"] > ranks[A]["rank"])
check("community path promoted after independent successes", st[cand_id][0] == "verified")
check("promoted community path is labelled COMMUNITY_VERIFIED", st[cand_id][1] == "COMMUNITY_VERIFIED")
check("12 new accounts did NOT promote their shortcut", st[s_id][0] == "candidate")
check("sybil shortcut scores below the reliable link", s_id not in ranks or ranks[s_id]["score"] < ranks[P]["score"])
check("evidence from 1-day-old accounts carries zero weight (feedback stays at the prior)",
      s_id in ranks and abs(float(ranks[s_id]["c_feedback"]) - 0.15) < 0.01 and abs(float(ranks[s_id]["c_usage"]) - 0.15) < 0.01)
check("the 'wrong form' link lost ground after wrong_page reports", ranks[A]["c_usage"] < ranks[P]["c_usage"])

pune = recommend(conn, "water supply problem tap not working", ward_id=W7, limit=6, clf=clf)
show(pune, "9. Same kind of query from Pune ward 7 (location filtering)")
titles = " ".join(r["website_name"] for r in pune["results"])
check("Pune query returns Pune site and no Jaipur-only sites", "Pune" in titles and "Jaipur" not in titles)

gen = recommend(conn, "something strange happening near my house", ward_id=W24, limit=4, clf=clf)
show(gen, "10. Unclear query (fallback to general grievance portals)")
check("unclear query falls back to general grievance portals", gen["used_fallback"] and len(gen["results"]) >= 1)

# ----------------------------------------------------------------- 11. regression: relevance must beat borrowed evidence
print("\n11. Relevance and context checks")
drain = recommend(conn, "drain overflowing near market, nali ka paani sadak par", ward_id=W24, limit=8, clf=clf)
show(drain, "   Drainage query from Jaipur ward 24")
check("drainage query finds the drainage form first, not the popular water-supply link",
      drain["category"] == "Sewerage" and drain["results"][0]["title"].startswith("Register drainage"))
check("drainage query returns no water-supply links (wrong problem family)",
      not any("water supply" in r["title"].lower() for r in drain["results"]))

jai = {r["link_id"]: r for r in recommend(conn, QUERY, ward_id=W24, limit=12, clf=clf)["results"]}
pun = {r["link_id"]: r for r in recommend(conn, QUERY, ward_id=W7, limit=12, clf=clf)["results"]}
print(f"   National portal usage score: Jaipur query {jai[N]['c_usage']}, Pune query {pun[N]['c_usage']} (prior is 0.15)")
check("national portal is offered in both districts", N in jai and N in pun)
check("Jaipur successes raise the national portal's usage score in Jaipur", float(jai[N]["c_usage"]) > 0.3)
check("...but not in Pune: ranking is contextual, evidence stays in its district", abs(float(pun[N]["c_usage"]) - 0.15) < 0.01)
check("the Pune query's own link still ranks first in Pune", pune["results"][0]["website_name"].startswith("Pune"))

# a single user clicking and reporting success many times must not inflate a link
spammer = est[39]
for k in range(30):
    visit(spammer, N, day(0, 12 - k * 0.2), "success")
cur.execute("SELECT count(*) FROM link_visits v JOIN website_sessions s USING (session_id) WHERE s.user_id=%s AND v.link_id=%s", (spammer, N))
reports = cur.fetchone()[0]
T = datetime.now(timezone.utc)                       # same reference time for both measurements
cur.execute("SELECT refresh_website_ranking(%s, %s)", (N, T))
cur.execute("SELECT use_n FROM website_ranking WHERE link_id=%s AND district_id=%s", (N, JAIPUR))
with_spam = float(cur.fetchone()[0])
cur.execute("SAVEPOINT one_report")                  # counterfactual: keep only this user's latest report
cur.execute("""DELETE FROM link_visits WHERE link_id=%s AND session_id IN (SELECT session_id FROM website_sessions WHERE user_id=%s)
               AND visit_id <> (SELECT v.visit_id FROM link_visits v JOIN website_sessions s USING (session_id)
                                WHERE s.user_id=%s AND v.link_id=%s ORDER BY v.opened_at DESC LIMIT 1)""", (N, spammer, spammer, N))
cur.execute("SELECT refresh_website_ranking(%s, %s)", (N, T))
cur.execute("SELECT use_n FROM website_ranking WHERE link_id=%s AND district_id=%s", (N, JAIPUR))
with_one = float(cur.fetchone()[0])
cur.execute("ROLLBACK TO SAVEPOINT one_report")
print(f"   {reports} success reports from one user: usage weight {with_spam:.3f}; the same user reporting once: {with_one:.3f}")
check("30 repeat reports from one user weigh exactly the same as one report", abs(with_spam - with_one) < 1e-9)
cur.execute("SELECT refresh_website_ranking(%s, %s)", (N, T))
conn.commit()

# a recommendation, a click and a multi-step session
rec = recommend(conn, QUERY, ward_id=W24, user_id=est[1], limit=3, clf=clf)
top = rec["results"][0]["link_id"]
vid, _ = start_visit(conn, est[1], top, query_id=rec["query_id"])
cur.execute("SELECT selected_at IS NOT NULL FROM recommendation_logs WHERE query_id=%s AND link_id=%s", (rec["query_id"], top))
check("a click on a recommended link is recorded against that recommendation", cur.fetchone()[0])
check("every result carries a tracked /go/ link and a plain-language reason",
      all(r["go_url"].startswith("/go/") and r["reason"] for r in rec["results"]))
sid = session_of(conn, vid)
t0 = day(0, 3)
cur.execute("UPDATE link_visits SET opened_at=%s WHERE visit_id=%s", (t0, vid))
conn.commit()
second = LINK[swap["https://jaipurmc.example/citizen/water"]]
vid2, _ = start_visit(conn, est[1], second, at=t0 + timedelta(seconds=95), session_id=sid)
cur.execute("SELECT duration_seconds, next_link_id FROM link_visits WHERE visit_id=%s", (vid,))
dur, nxt = cur.fetchone()
cur.execute("SELECT previous_link_id FROM link_visits WHERE visit_id=%s", (vid2,))
check("two-step session: first visit lasted 95 s and points to the next link", dur == 95 and nxt == second)
check("two-step session: second visit points back to the first link", cur.fetchone()[0] == top)

# ----------------------------------------------------------------- 12. schema rules from the SRS
print("\n12. Schema rules (SRS 16.1 and 17.1)")


def rejects(sql, params=()):
    cur.execute("SAVEPOINT t")
    try:
        cur.execute(sql, params)
        cur.execute("ROLLBACK TO SAVEPOINT t")
        return False
    except (psycopg2.IntegrityError, psycopg2.DataError):
        cur.execute("ROLLBACK TO SAVEPOINT t")
        return True


cur.execute("SELECT state_id FROM states WHERE state_code='MH'")
MH = cur.fetchone()[0]
cur.execute("SELECT state_id FROM states WHERE state_code='RJ'")
RJ = cur.fetchone()[0]
check("same district name is allowed in another state", not rejects("INSERT INTO districts(state_id, district_name) VALUES (%s,'Jaipur')", (MH,)))
check("duplicate district name inside one state is rejected", rejects("INSERT INTO districts(state_id, district_name) VALUES (%s,'Jaipur')", (RJ,)))
cur.execute("SELECT local_body_id FROM wards WHERE ward_number='24'")
LB = cur.fetchone()[0]
check("duplicate ward number inside one local body is rejected", rejects("INSERT INTO wards(local_body_id, ward_number) VALUES (%s,'24')", (LB,)))
check("official assignment must have a jurisdiction",
      rejects("INSERT INTO official_assignments(official_id, position_id, start_date) VALUES (1,1,'2026-01-01')"))
cur.execute("INSERT INTO officials(name) VALUES ('Test Official') RETURNING official_id")
OFF = cur.fetchone()[0]
check("assignment end date before start date is rejected",
      rejects("INSERT INTO official_assignments(official_id, position_id, state_id, start_date, end_date) VALUES (%s,1,%s,'2026-05-01','2026-01-01')", (OFF, RJ)))
check("vote value outside -1/0/1 is rejected", rejects("INSERT INTO website_votes(user_id, link_id, vote) VALUES (%s,%s,2)", (est[0], P)))
check("rating outside 1-5 is rejected", rejects("INSERT INTO link_feedback(user_id, link_id, rating) VALUES (%s,%s,6)", (est[2], P)))
check("non-normalised (upper-case) website domain is rejected",
      rejects("INSERT INTO websites(website_name, domain, base_url, website_type) VALUES ('x','Example.COM','https://x','service')"))
check("audit action must be one of the SRS values", rejects("INSERT INTO audit_logs(action, entity_type) VALUES ('HACK','x')"))
cur.execute("SELECT count(*) FROM audit_logs WHERE entity_type='website_links'")
check("state and URL changes were written to the audit log", cur.fetchone()[0] > 0)
cur.execute("SELECT sum(value) FROM ranking_config WHERE key LIKE 'w\\_%'")
check("ranking weights are configurable data and still sum to 1", abs(float(cur.fetchone()[0]) - 1.0) < 1e-9)
conn.commit()

failed = [n for n, ok in checks if not ok]
print(f"\n{len(checks) - len(failed)}/{len(checks)} checks passed")
if failed:
    print("FAILED:", failed)
    sys.exit(1)
