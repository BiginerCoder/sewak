"""Polite fetcher for the link catalog.

Rules it enforces:
  * only domains on the allowlist (government domains by default)
  * robots.txt is honoured, with a per-host delay
  * redirects are followed manually and every hop is re-checked against the allowlist
  * one page per request, a size cap, no cookies, no form submission, no login
  * stored URLs are sanitised: query strings, fragments and session ids are removed
"""
import hashlib
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from html.parser import HTMLParser

UA = "GovLinksBot/0.1 (link health checker for a civic project)"
REDIRECT_CODES = {301, 302, 303, 307, 308}
SOFT_404 = re.compile(r"\b(404|not found|page not found|no longer available)\b", re.I)
LOOPBACK = {"127.0.0.1", "localhost", "::1"}


def normalize_url(url: str) -> str:
    """Canonical form used for de-duplication and for anything saved from a user."""
    p = urllib.parse.urlsplit(url.strip())
    host = (p.hostname or "").lower()
    default = (p.scheme.lower(), p.port) in (("http", 80), ("https", 443))
    netloc = host if p.port is None or default else f"{host}:{p.port}"
    path = re.sub(r";jsessionid=[^/?#]*", "", p.path, flags=re.I) or "/"
    if len(path) > 1:
        path = path.rstrip("/")
    return urllib.parse.urlunsplit((p.scheme.lower(), netloc, path, "", ""))


def host_of(url: str) -> str:
    return (urllib.parse.urlsplit(url).hostname or "").lower()


def domain_allowed(host: str, rules, allow_demo: bool = False) -> bool:
    for pattern, kind in rules:
        if kind == "demo" and not allow_demo:
            continue
        if pattern.startswith("*."):
            suffix = pattern[1:]
            if host.endswith(suffix) or host == pattern[2:]:
                return True
        elif host == pattern:
            return True
    return False


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.h1 = ""
        self.links = []          # (href, text)
        self._in = None
        self._href = None
        self._buf = []

    def handle_starttag(self, tag, attrs):
        if tag in ("title", "h1") and not getattr(self, tag if tag == "h1" else "title"):
            self._in = tag
            self._buf = []
        elif tag == "a":
            self._href = dict(attrs).get("href")
            self._buf = []
            self._in = "a"

    def handle_data(self, data):
        if self._in:
            self._buf.append(data)

    def handle_endtag(self, tag):
        if self._in == tag:
            text = " ".join("".join(self._buf).split())
            if tag == "title":
                self.title = text
            elif tag == "h1":
                self.h1 = text
            elif tag == "a" and self._href:
                self.links.append((self._href, text))
            self._in = None


class Fetcher:
    def __init__(self, conn, allow_demo=False, min_delay=1.0, timeout=10, max_bytes=512_000, max_redirects=5, canary_url=None):
        self.conn = conn
        self.allow_demo = allow_demo
        self.min_delay = min_delay
        self.timeout = timeout
        self.max_bytes = max_bytes
        self.max_redirects = max_redirects
        self.canary_url = canary_url      # a site that is always up; proves the checker itself has network access
        with conn.cursor() as cur:
            cur.execute("SELECT pattern, kind FROM allowed_domains")
            self.rules = cur.fetchall()
        self._robots = {}
        self._last = {}
        self._proxied = urllib.request.build_opener(_NoRedirect)
        self._direct = urllib.request.build_opener(_NoRedirect, urllib.request.ProxyHandler({}))

    # ---- policy -------------------------------------------------------------
    def allowed(self, url):
        return domain_allowed(host_of(url), self.rules, self.allow_demo)

    def _opener(self, url):
        return self._direct if host_of(url) in LOOPBACK else self._proxied

    def _raw(self, url, limit=None):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*;q=0.5"})
        try:
            with self._opener(url).open(req, timeout=self.timeout) as r:
                return r.status, dict(r.headers), r.read(limit or self.max_bytes)
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), e.read(limit or self.max_bytes) if e.fp else b""

    def robots_ok(self, url):
        p = urllib.parse.urlsplit(url)
        key = f"{p.scheme}://{p.netloc}"
        if key not in self._robots:
            rp = urllib.robotparser.RobotFileParser()
            try:
                status, _, body = self._raw(f"{key}/robots.txt", 100_000)
                if status in (401, 403):
                    rp.parse(["User-agent: *", "Disallow: /"])
                elif status >= 400:
                    rp.parse([])
                else:
                    rp.parse(body.decode("utf-8", "replace").splitlines())
            except Exception:
                rp.parse([])              # unreachable robots.txt: the page request itself will report the failure
            self._robots[key] = rp
        return self._robots[key].can_fetch(UA, url)

    def _wait(self, host):
        gap = time.monotonic() - self._last.get(host, 0)
        if gap < self.min_delay:
            time.sleep(self.min_delay - gap)
        self._last[host] = time.monotonic()

    # ---- fetching -----------------------------------------------------------
    def fetch_page(self, url):
        """Follow redirects by hand. Returns a result dict; skipped=True means policy blocked it (not a link failure)."""
        res = {"ok": False, "skipped": False, "status_code": None, "final_url": None, "redirected": False,
               "page_title": None, "content_hash": None, "error": None, "elapsed_ms": None, "body": b""}
        started = time.monotonic()
        cur = url
        try:
            for _ in range(self.max_redirects + 1):
                if not self.allowed(cur):
                    res.update(skipped=(cur == url), error="domain not on allowlist" if cur == url else f"redirected off allowlist to {host_of(cur)}")
                    return res
                if not self.robots_ok(cur):
                    res.update(skipped=True, error="disallowed by robots.txt")
                    return res
                self._wait(host_of(cur))
                status, headers, body = self._raw(cur)
                res["status_code"] = status
                loc = headers.get("Location") or headers.get("location")
                if status in REDIRECT_CODES and loc:
                    cur = urllib.parse.urljoin(cur, loc)
                    res["redirected"] = True
                    continue
                res["final_url"] = cur
                res["body"] = body
                break
            else:
                res["error"] = "too many redirects"
                return res
        except Exception as e:                                  # network error, DNS, timeout
            res["error"] = f"{type(e).__name__}: {e}"
            return res
        finally:
            res["elapsed_ms"] = int((time.monotonic() - started) * 1000)

        parser = PageParser()
        try:
            parser.feed(res["body"].decode("utf-8", "replace"))
        except Exception:
            pass
        res["page_title"] = parser.title or None
        res["links"] = parser.links
        res["content_hash"] = hashlib.sha256(f"{parser.title}|{parser.h1}".lower().encode()).hexdigest()[:16]
        soft = bool(SOFT_404.search(f"{parser.title} {parser.h1}"))
        res["ok"] = 200 <= res["status_code"] < 300 and not soft
        if soft and res["ok"] is False and not res["error"]:
            res["error"] = "page looks like a soft 404"
        if not res["ok"] and not res["error"]:
            res["error"] = f"HTTP {res['status_code']}"
        return res

    # ---- health checks ------------------------------------------------------
    def _network_ok(self):
        if not self.canary_url:
            return False                   # cannot prove connectivity, so a connection failure proves nothing
        try:
            return self._raw(self.canary_url, 2000)[0] < 500
        except Exception:
            return False

    def check_link(self, link_id, at=None):
        with self.conn.cursor() as cur:
            cur.execute("SELECT url FROM website_links WHERE link_id=%s", (link_id,))
            url = cur.fetchone()[0]
            res = self.fetch_page(url)
            if res["skipped"]:
                return {"link_id": link_id, "url": url, **{k: res[k] for k in ("skipped", "error")}}
            cur.execute("SELECT content_hash FROM link_health_checks WHERE link_id=%s ORDER BY checked_at DESC LIMIT 1", (link_id,))
            prev = cur.fetchone()
            changed = bool(prev and prev[0] and res["content_hash"] and prev[0] != res["content_hash"])
            final = normalize_url(res["final_url"]) if res["final_url"] else None
            # no HTTP answer at all: only a failure if the checker itself demonstrably has network access
            inconclusive = res["status_code"] is None and (
                "Tunnel connection failed" in (res["error"] or "") or not self._network_ok())
            cur.execute(
                """INSERT INTO link_health_checks(link_id, checked_at, ok, status_code, final_url, redirected, page_title,
                                                  content_hash, content_changed, error, elapsed_ms, inconclusive)
                   VALUES (%s, COALESCE(%s, now()), %s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (link_id, at, res["ok"], res["status_code"], final, res["redirected"], res["page_title"],
                 res["content_hash"], changed, res["error"], res["elapsed_ms"], inconclusive))
            cur.execute("UPDATE website_links SET last_checked_at=COALESCE(%s, now()), last_status_code=%s, content_hash=%s WHERE link_id=%s",
                        (at, res["status_code"], res["content_hash"], link_id))
        self.conn.commit()
        return {"link_id": link_id, "url": url, "ok": res["ok"], "status_code": res["status_code"],
                "redirected": res["redirected"], "final_url": final, "error": res["error"],
                "content_changed": changed, "skipped": False, "inconclusive": inconclusive}

    def check_all(self, at=None):
        with self.conn.cursor() as cur:
            cur.execute("SELECT link_id FROM website_links WHERE status AND state <> 'retired' ORDER BY link_id")
            ids = [r[0] for r in cur.fetchall()]
        return [self.check_link(i, at) for i in ids]

    # ---- discovery ----------------------------------------------------------
    def discover_links(self, website_id, classifier, min_score=0.6, limit=25):
        """Read the portal's front page only (depth 1) and save same-site links whose text
        looks like a known problem category. They enter the catalog as unverified candidates."""
        with self.conn.cursor() as cur:
            cur.execute("SELECT base_url FROM websites WHERE website_id=%s", (website_id,))
            base = cur.fetchone()[0]
        page = self.fetch_page(base)
        if not page["ok"]:
            return {"website_id": website_id, "added": [], "error": page["error"]}
        added, seen = [], set()
        with self.conn.cursor() as cur:
            cur.execute("SELECT url FROM website_links WHERE website_id=%s", (website_id,))
            known = {normalize_url(r[0]) for r in cur.fetchall()}
            for href, text in page["links"]:
                if not text or href.startswith(("#", "mailto:", "tel:", "javascript:")):
                    continue
                full = urllib.parse.urljoin(page["final_url"], href)
                if urllib.parse.urlsplit(full).netloc != urllib.parse.urlsplit(page["final_url"]).netloc:
                    continue                                    # other site: not ours to catalog
                clean = normalize_url(full)
                if clean in known or clean in seen:
                    continue
                cat_id, cat_name, score, _ = classifier(text)
                if cat_id is None or score < min_score:
                    continue
                seen.add(clean)
                action = "file_complaint" if re.search(r"complain|grievance|register|report", text, re.I) else "info"
                cur.execute(
                    """INSERT INTO website_links(website_id, category_id, title, url, action, link_type, source, trust_label, state)
                       VALUES (%s,%s,%s,%s,%s,'landing_page','crawler','UNVERIFIED','candidate')
                       ON CONFLICT (website_id, url) DO NOTHING RETURNING link_id""",
                    (website_id, cat_id, text[:200], clean, action))
                row = cur.fetchone()
                if row:
                    added.append({"link_id": row[0], "title": text[:80], "url": clean, "category": cat_name, "score": round(score, 2)})
                if len(added) >= limit:
                    break
        self.conn.commit()
        return {"website_id": website_id, "added": added, "error": None}
