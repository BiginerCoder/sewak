"""Minimal HTTP API over the recommender (standard library only). Paths follow SRS section 15.

  GET  /api/health
  GET  /api/wards                 wards with their local body, district and state (for a location picker)
  GET  /api/categories            problem categories (for correcting a wrong guess)
  GET  /api/links?ward_id=1       all active service links that cover an area
                                  accepts exactly one ward_id, local_body_id, district_id or state_id
  POST /api/recommendations       {"query": "...", "ward_id": 1}  or  {"query": "...", "district_id": ..}
                                  optional "category": "Sewerage" overrides the detected category
                                  -> {"problem_category", "recommended_link", "results": [...]}
  POST /api/visits                {"user_id": 1, "link_id": 4, "query_id": 5} -> {"visit_id", "url"}
                                  Logs the click and returns the page to open. Use this when the client needs the visit id.
  GET  /go/<link_id>?user_id=1&query_id=5     same, as a plain 302 redirect (visit id in the X-Visit-Id header)
  POST /api/outcomes              {"visit_id": 3, "outcome": "success|failed|broken|wrong_page", "final_url": "..."}
  POST /api/votes                 {"user_id": 1, "link_id": 4, "vote": 1, "query_id": 5}
  POST /api/feedback              {"user_id": 1, "link_id": 4, "query_id": 5, "useful": true, "rating": 4}
  POST /api/flags                 {"user_id": 1, "link_id": 4, "reason": "broken"}
  POST /api/dev/user              {"established": true}  creates a throwaway account (demo mode only)

Run:  python3 api.py                    (127.0.0.1:8080)
Set GOVLINKS_ALLOW_DEMO=1 for demo mode: placeholder hosts (127.0.0.1 and *.example) may be opened and the
dev-only endpoint is enabled.

DEVELOPMENT ONLY: there is no authentication. user_id is taken from the request, so anyone can claim to be anyone.
Before real use, derive user_id from a verified session token and rate-limit every endpoint.
"""
import json
import logging
import os
import urllib.parse
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from govlinks.db import connect
from govlinks.fetcher import domain_allowed, host_of
from govlinks.recommender import give_feedback, record_outcome, recommend, start_visit, vote

ALLOW_DEMO = os.environ.get("GOVLINKS_ALLOW_DEMO") == "1"
HOST = os.environ.get("GOVLINKS_HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", os.environ.get("GOVLINKS_PORT", "8080")))


def _int(v):
    return int(v) if v not in (None, "") else None


def _host_ok(url, rules):
    """Only stored URLs on an allowlisted host may be opened. In demo mode the placeholder *.example hosts also pass."""
    host = host_of(url)
    return domain_allowed(host, rules, allow_demo=ALLOW_DEMO) or (ALLOW_DEMO and host.endswith(".example"))


def _openable(conn, link_id):
    """Returns (http_status, error_message, url). Status 200 means the link may be opened."""
    with conn.cursor() as cur:
        cur.execute("SELECT url, status FROM website_links WHERE link_id=%s", (link_id,))
        row = cur.fetchone()
        cur.execute("SELECT pattern, kind FROM allowed_domains")
        rules = cur.fetchall()
    if not row or not row[1]:
        return 404, "link not found", None
    if not _host_ok(row[0], rules):
        return 403, "destination is not on the allowlist", None
    return 200, None, row[0]


def _rows(cur):
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def _area_links(conn, query):
    area_keys = ("ward_id", "local_body_id", "district_id", "state_id")
    selected = [(key, _int(query.get(key))) for key in area_keys if query.get(key) not in (None, "")]
    if len(selected) != 1 or selected[0][1] is None or selected[0][1] <= 0:
        raise ValueError("exactly one valid area id is required")

    key, area_id = selected[0]
    with conn.cursor() as cur:
        if key == "ward_id":
            cur.execute("SELECT ward_id, local_body_id, district_id, state_id FROM resolve_location(%s)", (area_id,))
            row = cur.fetchone()
            if row is None:
                return None
            ward_id, local_body_id, district_id, state_id = row
        elif key == "local_body_id":
            cur.execute("""SELECT lb.local_body_id, lb.district_id, d.state_id
                           FROM local_bodies lb JOIN districts d USING (district_id)
                           WHERE lb.local_body_id=%s""", (area_id,))
            row = cur.fetchone()
            if row is None:
                return None
            local_body_id, district_id, state_id = row
            ward_id = None
        elif key == "district_id":
            cur.execute("SELECT district_id, state_id FROM districts WHERE district_id=%s", (area_id,))
            row = cur.fetchone()
            if row is None:
                return None
            district_id, state_id = row
            local_body_id = ward_id = None
        else:
            cur.execute("SELECT state_id FROM states WHERE state_id=%s", (area_id,))
            row = cur.fetchone()
            if row is None:
                return None
            state_id = row[0]
            district_id = local_body_id = ward_id = None

        cur.execute("SELECT country_id FROM states WHERE state_id=%s", (state_id,))
        country_id = cur.fetchone()[0]
        cur.execute("""WITH matching_locations AS (
                         SELECT wl.website_id,
                                max(CASE WHEN wl.ward_id IS NOT NULL THEN 5
                                         WHEN wl.local_body_id IS NOT NULL THEN 4
                                         WHEN wl.district_id IS NOT NULL THEN 3
                                         WHEN wl.state_id IS NOT NULL THEN 2 ELSE 1 END) AS location_rank,
                                max(wl.priority) AS priority
                         FROM website_locations wl
                         WHERE wl.is_active
                           AND (wl.country_id IS NULL OR wl.country_id=%s)
                           AND (wl.state_id IS NULL OR wl.state_id=%s)
                           AND (wl.district_id IS NULL OR wl.district_id=%s)
                           AND (wl.local_body_id IS NULL OR wl.local_body_id=%s)
                           AND (wl.ward_id IS NULL OR wl.ward_id=%s)
                         GROUP BY wl.website_id
                       )
                       SELECT l.link_id, l.title, l.url, l.action, l.link_type, l.state,
                              l.trust_label, l.steps, l.login_required, l.last_verified_at,
                              c.category_name, w.website_name, w.domain, w.official_status,
                              w.is_demo, m.location_rank,
                              CASE m.location_rank WHEN 5 THEN 'ward' WHEN 4 THEN 'local body'
                                   WHEN 3 THEN 'district' WHEN 2 THEN 'state' ELSE 'country' END AS location_scope,
                              COALESCE(l.is_partner_promoted, false) AS is_partner_promoted,
                              l.partner_id, l.partner_note
                       FROM website_links l
                       JOIN websites w ON w.website_id=l.website_id AND w.status
                       JOIN problem_categories c ON c.category_id=l.category_id
                       JOIN matching_locations m ON m.website_id=l.website_id
                       WHERE l.status AND l.state <> 'retired'
                       ORDER BY l.is_partner_promoted DESC, m.location_rank DESC, m.priority DESC, w.official_status DESC,
                                (l.state='verified') DESC, l.title""",
                    (country_id, state_id, district_id, local_body_id, ward_id))
        links = _rows(cur)

    allowed_domains = _allowed_domains(conn)
    for link in links:
        link["openable"] = _host_ok(link["url"], allowed_domains) and (
            ALLOW_DEMO or not link["is_demo"]
        )
    return links


def _allowed_domains(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT pattern, kind FROM allowed_domains")
        return cur.fetchall()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        logging.info(
            "client=%s method=%s path=%s response=%s",
            self.client_address[0],
            self.command,
            self.path.partition("?")[0],
            args[0] if args else "",
        )

    def _json(self, code, obj):
        data = json.dumps(obj, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    # ------------------------------------------------------------------ GET
    def do_GET(self):
        u = urllib.parse.urlsplit(self.path)
        q = dict(urllib.parse.parse_qsl(u.query))
        if u.path == "/api/health":
            return self._json(200, {"ok": True, "demo": ALLOW_DEMO})
        if not (u.path.startswith("/go/") or u.path in ("/api/wards", "/api/categories", "/api/links")):
            return self._json(404, {"error": "not found"})
        conn = connect()
        try:
            if u.path == "/api/wards":
                with conn.cursor() as cur:
                    cur.execute("""SELECT w.ward_id, w.ward_number, w.ward_name, lb.local_body_id, lb.body_name AS local_body,
                                          d.district_id, d.district_name AS district, s.state_id, s.state_name AS state
                                   FROM wards w JOIN local_bodies lb USING (local_body_id)
                                   JOIN districts d USING (district_id) JOIN states s USING (state_id)
                                   ORDER BY s.state_name, d.district_name, lb.body_name, w.ward_number LIMIT 1000""")
                    return self._json(200, _rows(cur))
            if u.path == "/api/categories":
                with conn.cursor() as cur:
                    cur.execute("""SELECT c.category_id, c.category_name, p.category_name AS parent, c.is_fallback
                                   FROM problem_categories c LEFT JOIN problem_categories p ON p.category_id = c.parent_category_id
                                   ORDER BY COALESCE(p.category_name, c.category_name), p.category_name NULLS FIRST, c.category_name""")
                    return self._json(200, _rows(cur))
            if u.path == "/api/links":
                links = _area_links(conn, q)
                if links is None:
                    return self._json(404, {"error": "area not found"})
                return self._json(200, {"links": links})
            link_id = int(u.path.split("/")[2])
            user_id = _int(q.get("user_id"))
            if user_id is None:
                return self._json(400, {"error": "user_id required"})
            code, err, _ = _openable(conn, link_id)
            if code != 200:
                return self._json(code, {"error": err})
            visit_id, url = start_visit(conn, user_id, link_id, _int(q.get("query_id")))
            self.send_response(302)
            self.send_header("Location", url)
            self.send_header("X-Visit-Id", str(visit_id))
            self.end_headers()
        except (ValueError, IndexError):
            return self._json(400, {"error": "bad request"})
        except psycopg2.Error:
            conn.rollback()
            return self._json(400, {"error": "invalid data"})
        finally:
            conn.close()

    # ------------------------------------------------------------------ POST
    def do_POST(self):
        conn = connect()
        try:
            b = self._body()
            if self.path == "/api/recommendations":
                if not str(b.get("query", "")).strip():
                    return self._json(400, {"error": "query required"})
                return self._json(200, recommend(
                    conn, b["query"], b.get("user_id"), b.get("ward_id"), int(b.get("limit", 5)),
                    state_id=b.get("state_id"), district_id=b.get("district_id"), local_body_id=b.get("local_body_id"),
                    category=b.get("category")))
            if self.path == "/api/visits":
                link_id = int(b["link_id"])
                code, err, _ = _openable(conn, link_id)
                if code != 200:
                    return self._json(code, {"error": err})
                visit_id, url = start_visit(conn, int(b["user_id"]), link_id, _int(b.get("query_id")))
                return self._json(200, {"visit_id": visit_id, "url": url})
            if self.path == "/api/outcomes":
                return self._json(200, record_outcome(conn, int(b["visit_id"]), b["outcome"], b.get("proof_type", "none"),
                                                      b.get("proof_ref"), b.get("final_url"), allow_demo=ALLOW_DEMO))
            if self.path == "/api/votes":
                vote(conn, int(b["user_id"]), int(b["link_id"]), int(b["vote"]), _int(b.get("query_id")))
                return self._json(200, {"ok": True})
            if self.path == "/api/feedback":
                give_feedback(conn, int(b["user_id"]), int(b["link_id"]), _int(b.get("query_id")), b.get("useful"),
                              b.get("rating"), b.get("problem_solved"), b.get("comment"))
                return self._json(200, {"ok": True})
            if self.path == "/api/flags":
                with conn.cursor() as cur:
                    cur.execute("INSERT INTO link_flags(link_id, user_id, reason) VALUES (%s,%s,%s)",
                                (int(b["link_id"]), _int(b.get("user_id")), b["reason"]))
                conn.commit()
                return self._json(200, {"ok": True})
            if self.path == "/api/partner/links":
                title = str(b.get("title", "")).strip()
                url = str(b.get("url", "")).strip()
                category_id = _int(b.get("category_id"))
                if not title or not url or not category_id:
                    return self._json(400, {"error": "title, url and category_id are required"})
                partner_id = _int(b.get("partner_id")) or 2
                partner_note = str(b.get("partner_note", "")).strip() or "Verified Partner Link"
                action = b.get("action", "file_complaint")
                link_type = b.get("link_type", "direct_form")
                steps = b.get("steps")
                domain = host_of(url)

                with conn.cursor() as cur:
                    cur.execute("SELECT website_id FROM websites WHERE domain = %s", (domain,))
                    row = cur.fetchone()
                    if row:
                        website_id = row[0]
                    else:
                        cur.execute("""
                            INSERT INTO websites (website_name, domain, base_url, website_type, official_status, is_demo)
                            VALUES (%s, %s, %s, 'service', true, %s) RETURNING website_id
                        """, (domain, domain, f"https://{domain}", domain.endswith(".example") or "127.0.0.1" in domain))
                        website_id = cur.fetchone()[0]

                    # Ensure website category
                    cur.execute("""
                        INSERT INTO website_categories (website_id, category_id, priority)
                        VALUES (%s, %s, 10) ON CONFLICT (website_id, category_id) DO NOTHING
                    """, (website_id, category_id))

                    # If location scope is passed, add website_location
                    ward_id = _int(b.get("ward_id"))
                    local_body_id = _int(b.get("local_body_id"))
                    district_id = _int(b.get("district_id"))
                    state_id = _int(b.get("state_id"))
                    if any([ward_id, local_body_id, district_id, state_id]):
                        cur.execute("""
                            INSERT INTO website_locations (website_id, state_id, district_id, local_body_id, ward_id, priority)
                            VALUES (%s, %s, %s, %s, %s, 10)
                        """, (website_id, state_id, district_id, local_body_id, ward_id))

                    cur.execute("""
                        INSERT INTO website_links (
                            website_id, category_id, title, url, action, link_type, steps,
                            trust_label, state, is_partner_promoted, partner_id, partner_note
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s,
                            'PLATFORM_VERIFIED', 'verified', true, %s, %s
                        ) ON CONFLICT (website_id, url) DO UPDATE
                        SET is_partner_promoted = true,
                            partner_note = EXCLUDED.partner_note,
                            title = EXCLUDED.title,
                            steps = EXCLUDED.steps,
                            state = 'verified'
                        RETURNING link_id
                    """, (website_id, category_id, title, url, action, link_type, steps, partner_id, partner_note))
                    new_link_id = cur.fetchone()[0]

                conn.commit()
                return self._json(200, {"ok": True, "link_id": new_link_id, "title": title})

            if self.path == "/api/dev/user":
                if not ALLOW_DEMO:
                    return self._json(404, {"error": "not found"})
                with conn.cursor() as cur:
                    cur.execute("""INSERT INTO users(email, password_hash, created_at)
                                   VALUES ('dev-' || gen_random_uuid() || '@demo.test', 'x',
                                           CASE WHEN %s THEN now() - interval '120 days' ELSE now() END) RETURNING user_id""",
                                (bool(b.get("established")),))
                    user_id = cur.fetchone()[0]
                conn.commit()
                return self._json(200, {"user_id": user_id, "established": bool(b.get("established"))})
            return self._json(404, {"error": "not found"})
        except (KeyError, ValueError, AssertionError, TypeError) as e:
            conn.rollback()
            return self._json(400, {"error": f"bad request: {type(e).__name__}"})
        except psycopg2.Error:
            conn.rollback()
            return self._json(400, {"error": "invalid data"})
        finally:
            conn.close()


if __name__ == "__main__":
    if ALLOW_DEMO and HOST not in {"127.0.0.1", "localhost", "::1"}:
        raise RuntimeError("Demo mode may only bind to a loopback interface.")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    logging.info("Govlinks API listening on %s:%s%s", HOST, PORT, " (demo mode)" if ALLOW_DEMO else "")
    server.serve_forever()
