"""Exercises every API endpoint against the demo database. Run demo.py first (it builds the data).

    python3 test_api.py
"""
import json
import os
import sys
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

os.environ["GOVLINKS_ALLOW_DEMO"] = "1"
import api                      # noqa: E402  (reads the env var at import time)
from govlinks import mock_site  # noqa: E402
from govlinks.db import connect  # noqa: E402

mock_site.start(8099)
srv = ThreadingHTTPServer(("127.0.0.1", 8081), api.Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:8081"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect)
results = []


def call(method, path, body=None, raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(BASE + path, method=method, data=data)
    try:
        with opener.open(req, timeout=10) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def check(name, ok):
    ok = bool(ok)
    results.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}")


conn = connect()
cur = conn.cursor()
cur.execute("SELECT ward_id FROM wards w JOIN local_bodies lb USING (local_body_id) WHERE lb.body_name LIKE 'Jaipur%' AND ward_number='24'")
W24 = cur.fetchone()[0]
cur.execute("SELECT district_id FROM districts WHERE district_name='Jaipur'")
JAIPUR = cur.fetchone()[0]
cur.execute("SELECT user_id FROM users ORDER BY user_id LIMIT 3")
U1, U2, U3 = [r[0] for r in cur.fetchall()]
cur.execute("SELECT link_id FROM website_links WHERE url LIKE 'http://127.0.0.1:8099/%' AND status ORDER BY link_id LIMIT 1")
LOCAL = cur.fetchone()[0]

print("API endpoint tests")
check("health", json.loads(call("GET", "/api/health")[2])["ok"])

st, _, body = call("POST", "/api/recommendations", {"query": "water supply is not coming in my area", "ward_id": W24, "user_id": U1, "limit": 3})
d = json.loads(body)
check("recommendations: 200 with category, a recommended link and ranked results",
      st == 200 and d["problem_category"] == "Water Supply" and d["recommended_link"]["url"] and len(d["results"]) == 3)
check("recommendations: every result has a reason and a tracked go_url", all(r["reason"] and r["go_url"].startswith("/go/") for r in d["results"]))

st, _, body = call("POST", "/api/recommendations", {"query": "water supply is not coming", "district_id": JAIPUR})
check("recommendations: works with a district id and no ward", st == 200 and json.loads(body)["results"])
check("recommendations: empty query is rejected (400)", call("POST", "/api/recommendations", {"query": "  "})[0] == 400)
check("recommendations: malformed JSON is rejected (400)", call("POST", "/api/recommendations", raw=b"{not json")[0] == 400)

st, h, _ = call("GET", f"/go/{LOCAL}?user_id={U2}&query_id={d['query_id']}")
check("go: 302 to the stored page with a visit id", st == 302 and h["Location"].startswith("http://127.0.0.1:8099/") and h.get("X-Visit-Id"))
visit_id = int(h["X-Visit-Id"])
check("go: missing user_id is rejected (400)", call("GET", f"/go/{LOCAL}")[0] == 400)
check("go: unknown link is 404", call("GET", f"/go/999999?user_id={U2}")[0] == 404)
check("go: non-numeric link id is rejected (400)", call("GET", f"/go/abc?user_id={U2}")[0] == 400)

cur.execute("SELECT link_id FROM website_links WHERE url LIKE 'https://jaipurmc.example/%' LIMIT 1")
placeholder = cur.fetchone()[0]
api.ALLOW_DEMO = False
check("go: a host that is not on the allowlist is refused (403), so it is not an open redirect",
      call("GET", f"/go/{placeholder}?user_id={U2}")[0] == 403)
api.ALLOW_DEMO = True

st, _, body = call("POST", "/api/outcomes", {"visit_id": visit_id, "outcome": "success"})
check("outcomes: success recorded", st == 200)
check("outcomes: invalid outcome value is rejected (400)", call("POST", "/api/outcomes", {"visit_id": visit_id, "outcome": "nonsense"})[0] == 400)
check("outcomes: unknown visit is rejected (400)", call("POST", "/api/outcomes", {"visit_id": 99999999, "outcome": "success"})[0] == 400)
cur.execute("SELECT success_signal FROM link_visits WHERE visit_id=%s", (visit_id,))
check("outcomes: the visit row was updated", cur.fetchone()[0] == "success")

check("votes: accepted", call("POST", "/api/votes", {"user_id": U3, "link_id": LOCAL, "vote": 1, "query_id": d["query_id"]})[0] == 200)
check("votes: value 5 is rejected (400)", call("POST", "/api/votes", {"user_id": U3, "link_id": LOCAL, "vote": 5})[0] == 400)
check("feedback: accepted", call("POST", "/api/feedback", {"user_id": U3, "link_id": LOCAL, "useful": True, "rating": 4})[0] == 200)
check("feedback: rating 9 is rejected (400)", call("POST", "/api/feedback", {"user_id": U3, "link_id": LOCAL, "rating": 9})[0] == 400)
check("flags: accepted", call("POST", "/api/flags", {"user_id": U3, "link_id": LOCAL, "reason": "outdated"})[0] == 200)
check("flags: unknown reason is rejected (400)", call("POST", "/api/flags", {"user_id": U3, "link_id": LOCAL, "reason": "whatever"})[0] == 400)
check("unknown path is 404", call("GET", "/nope")[0] == 404)


# ---- endpoints added for the React frontend
st, _, body = call("GET", "/api/wards")
wards = json.loads(body)
check("wards: lists wards with local body, district and state",
      st == 200 and any(w["ward_name"] == "Shastri Nagar" and w["district"] == "Jaipur" and w["state"] == "Rajasthan" for w in wards))
st, _, body = call("GET", "/api/categories")
cats = json.loads(body)
check("categories: includes the tree and flags the general-grievance fallback",
      st == 200 and any(c["category_name"] == "Sewerage" and c["parent"] == "Water" for c in cats) and any(c["is_fallback"] for c in cats))

st, _, body = call("POST", "/api/recommendations", {"query": "something odd near my house", "ward_id": W24, "category": "Sewerage"})
d2 = json.loads(body)
check("recommendations: a chosen category overrides the guess", st == 200 and d2["problem_category"] == "Sewerage" and d2["category_source"] == "user"
      and d2["results"][0]["title"].startswith("Register drainage"))
check("recommendations: unknown category is rejected (400)", call("POST", "/api/recommendations", {"query": "x", "category": "Nope"})[0] == 400)
st, _, body = call("POST", "/api/recommendations", {"query": "water supply problem", "ward_id": W24, "category": "General Grievance"})
check("recommendations: choosing General Grievance gives the general portals", st == 200 and json.loads(body)["used_fallback"])
check("recommendations: detected category is labelled as detected",
      json.loads(call("POST", "/api/recommendations", {"query": "water supply is not coming", "ward_id": W24})[2])["category_source"] == "detected")

st, _, body = call("POST", "/api/visits", {"user_id": U2, "link_id": LOCAL, "query_id": d["query_id"]})
v = json.loads(body)
check("visits: returns a visit id and the page to open", st == 200 and v["visit_id"] and v["url"].startswith("http://127.0.0.1:8099/"))
check("visits: the visit can then be closed with an outcome",
      call("POST", "/api/outcomes", {"visit_id": v["visit_id"], "outcome": "failed"})[0] == 200)
check("visits: missing user_id is rejected (400)", call("POST", "/api/visits", {"link_id": LOCAL})[0] == 400)
check("visits: placeholder *.example host opens in demo mode", call("POST", "/api/visits", {"user_id": U2, "link_id": placeholder})[0] == 200)
api.ALLOW_DEMO = False
check("visits: placeholder host is refused outside demo mode (403)", call("POST", "/api/visits", {"user_id": U2, "link_id": placeholder})[0] == 403)
check("dev user: endpoint does not exist outside demo mode (404)", call("POST", "/api/dev/user", {})[0] == 404)
api.ALLOW_DEMO = True
st, _, body = call("POST", "/api/dev/user", {"established": True})
nu = json.loads(body)
cur.execute("SELECT created_at < now() - interval '100 days' FROM users WHERE user_id=%s", (nu["user_id"],))
check("dev user: creates an established account on request", st == 200 and cur.fetchone()[0])
st, _, body = call("POST", "/api/dev/user", {})
cur.execute("SELECT created_at > now() - interval '1 hour' FROM users WHERE user_id=%s", (json.loads(body)["user_id"],))
check("dev user: creates a brand-new account by default", st == 200 and cur.fetchone()[0])
check("health reports demo mode", json.loads(call("GET", "/api/health")[2])["demo"] is True)

print(f"\n{sum(results)}/{len(results)} API checks passed")
sys.exit(0 if all(results) else 1)
