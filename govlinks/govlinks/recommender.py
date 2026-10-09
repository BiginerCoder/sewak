"""Query understanding, recommendation, visit tracking and outcome handling."""
import json
import re
import unicodedata

from .fetcher import LOOPBACK, domain_allowed, host_of, normalize_url

TOKEN = re.compile(r"[A-Za-zऀ-ॿ]+")


def _nfc(s):
    return unicodedata.normalize("NFC", s.lower())


def tokens(text):
    return {_nfc(t) for t in TOKEN.findall(unicodedata.normalize("NFC", text))}


def detect_action(text):
    t = tokens(text)
    if t & {"status", "track", "tracking"}:
        return "track_status"
    if t & {"apply", "new", "connection", "application"} and not t & {"complaint", "complain", "problem"}:
        return "apply_service"
    return "file_complaint"


class Classifier:
    """Keyword-weight classifier. Replace with an embedding or LLM model later; keep the same output shape."""

    def __init__(self, conn):
        with conn.cursor() as cur:
            cur.execute("SELECT keyword_id, normalized_keyword FROM keywords")
            self.kw = {_nfc(k): i for i, k in cur.fetchall()}
            cur.execute("""SELECT ck.keyword_id, c.category_id, c.category_name, ck.weight
                           FROM category_keywords ck JOIN problem_categories c USING (category_id)""")
            self.map = {}
            for kid, cid, cname, w in cur.fetchall():
                self.map.setdefault(kid, []).append((cid, cname, float(w)))
            cur.execute("SELECT category_id, category_name FROM problem_categories WHERE is_fallback LIMIT 1")
            self.fallback = cur.fetchone()

    def __call__(self, text):
        """Returns (category_id, category_name, score, matched_keyword_ids). category_id None means no confident match."""
        matched = [self.kw[t] for t in tokens(text) if t in self.kw]
        score, names = {}, {}
        for kid in matched:
            for cid, cname, w in self.map.get(kid, []):
                score[cid] = score.get(cid, 0) + w
                names[cid] = cname
        if not score:
            return None, None, 0.0, matched
        best = max(score, key=score.get)
        return (best, names[best], score[best], matched) if score[best] >= 0.5 else (None, None, score[best], matched)

    def alternatives(self, text, n=3):
        matched = [self.kw[t] for t in tokens(text) if t in self.kw]
        score, names = {}, {}
        for kid in matched:
            for cid, cname, w in self.map.get(kid, []):
                score[cid] = score.get(cid, 0) + w
                names[cid] = cname
        return sorted(((names[c], round(s, 2)) for c, s in score.items()), key=lambda x: -x[1])[:n]


def _reason(row, stats, loc_names):
    bits = [f"{row['link_type'].replace('_', ' ')} for {row['action'].replace('_', ' ')}"]
    bits.append(f"serves your {row['loc_level'].replace('_', ' ')}" if row["loc_level"] != "country" else "covers the whole country")
    if stats and stats["use_n"] > 0:
        bits.append(f"{stats['unique_success_users']} independent users completed it in your district")
    else:
        bits.append("no usage evidence from your district yet")
    if row["state"] == "stale":
        bits.append("WARNING: reported stale, may no longer work")
    elif row["state"] == "candidate":
        bits.append("unconfirmed path, shown with lower priority")
    return "; ".join(bits)


def recommend(conn, query, user_id=None, ward_id=None, limit=5, at=None, include_candidates=True, clf=None,
              state_id=None, district_id=None, local_body_id=None, category=None):
    clf = clf or Classifier(conn)
    cat_id, cat_name, cat_score, kw_ids = clf(query)
    fallback, source = False, "detected"
    if category:                         # the user corrected the guess: trust it, keep the query's keywords for refinement
        with conn.cursor() as c0:
            c0.execute("SELECT category_id, category_name, is_fallback FROM problem_categories WHERE category_name=%s", (category,))
            row = c0.fetchone()
        if row is None:
            raise ValueError(f"unknown category: {category}")
        cat_id, cat_name, cat_score, source = row[0], row[1], 1.0, "user"
        fallback = row[2]
        if fallback:
            cat_id, cat_name = clf.fallback
    elif cat_id is None:
        cat_id, cat_name = clf.fallback
        fallback, source = True, "fallback"
    action = detect_action(query)
    with conn.cursor() as cur:
        # A ward fixes every level above it. Without a ward, use whatever explicit levels the caller gave.
        ward, lb, dist, state = None, local_body_id, district_id, state_id
        if ward_id:
            cur.execute("SELECT ward_id, local_body_id, district_id, state_id FROM resolve_location(%s)", (ward_id,))
            ward, lb, dist, state = cur.fetchone() or (None, lb, dist, state)
        if lb and not dist:
            cur.execute("SELECT district_id FROM local_bodies WHERE local_body_id=%s", (lb,))
            dist = (cur.fetchone() or (None,))[0]
        if dist and not state:
            cur.execute("SELECT state_id FROM districts WHERE district_id=%s", (dist,))
            state = (cur.fetchone() or (None,))[0]
        cur.execute("""INSERT INTO user_queries(user_id, query_text, detected_category_id, state_id, district_id, local_body_id, ward_id, created_at)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,COALESCE(%s, now())) RETURNING query_id""",
                    (user_id, query, None if fallback else cat_id, state, dist, lb, ward, at))
        query_id = cur.fetchone()[0]
        for kid in set(kw_ids):
            cur.execute("INSERT INTO query_keywords VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                        (query_id, kid, min(1.0, cat_score)))
        cur.execute("""SELECT * FROM rank_links(%s,%s,%s,%s,%s,%s,%s,%s,%s,COALESCE(%s, now()))""",
                    (cat_id, state, dist, lb, ward, list(set(kw_ids)), action, include_candidates, limit, at))
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        ids = [r["link_id"] for r in rows]
        stats = {}
        if ids:
            cur.execute("SELECT link_id, use_n, unique_success_users FROM website_ranking "
                        "WHERE link_id = ANY(%s) AND district_id IS NOT DISTINCT FROM %s", (ids, dist))
            stats = {r[0]: {"use_n": float(r[1]), "unique_success_users": r[2]} for r in cur.fetchall()}
        for rank, r in enumerate(rows, 1):
            r["rank"] = rank
            r["score"] = float(r["score"])
            r["reason"] = _reason(r, stats.get(r["link_id"]), None)
            r["go_url"] = f"/go/{r['link_id']}?query_id={query_id}"
            cur.execute("""INSERT INTO recommendation_logs(query_id, link_id, score, rank, components, displayed_at)
                           VALUES (%s,%s,%s,%s,%s,COALESCE(%s, now()))""",
                        (query_id, r["link_id"], r["score"], rank,
                         json.dumps({k: float(r[k]) for k in ("c_feedback", "c_usage", "c_relevance", "c_location", "c_trust", "multiplier")}), at))
    conn.commit()
    category = None if fallback else cat_name
    top = rows[0] if rows else None
    return {"query_id": query_id, "category": category, "problem_category": category,
            "confidence_score": round(cat_score, 2), "category_source": source, "action": action, "alternatives": clf.alternatives(query),
            "used_fallback": fallback, "results": rows,
            "recommended_link": top and {"title": top["title"], "url": top["url"], "score": top["score"],
                                         "go_url": top["go_url"], "reason": top["reason"]}}


# ------------------------------------------------------------------ visits and outcomes
def start_visit(conn, user_id, link_id, query_id=None, at=None, via="redirect", session_id=None):
    """What /go/<link_id> does: log the click, then send the user on.
    Pass session_id to add another step to an existing browsing session; previous/next links are then chained."""
    with conn.cursor() as cur:
        cur.execute("SELECT website_id, url FROM website_links WHERE link_id=%s", (link_id,))
        website_id, url = cur.fetchone()
        prev = None
        if session_id is None:
            cur.execute("""INSERT INTO website_sessions(user_id, query_id, website_id, started_at)
                           VALUES (%s,%s,%s,COALESCE(%s, now())) RETURNING session_id""", (user_id, query_id, website_id, at))
            session_id = cur.fetchone()[0]
        else:
            cur.execute("SELECT visit_id, link_id FROM link_visits WHERE session_id=%s ORDER BY opened_at DESC, visit_id DESC LIMIT 1", (session_id,))
            prev = cur.fetchone()
        cur.execute("""INSERT INTO link_visits(session_id, link_id, opened_at, via, previous_link_id)
                       VALUES (%s,%s,COALESCE(%s, now()),%s,%s) RETURNING visit_id""", (session_id, link_id, at, via, prev and prev[1]))
        visit_id = cur.fetchone()[0]
        if prev:      # the user moved on: close the previous step and record where they went
            cur.execute("""UPDATE link_visits SET next_link_id=%s,
                           closed_at=COALESCE(closed_at, GREATEST(opened_at, COALESCE(%s, now()))) WHERE visit_id=%s""", (link_id, at, prev[0]))
        if query_id:
            cur.execute("UPDATE recommendation_logs SET selected_at=COALESCE(%s, now()) WHERE query_id=%s AND link_id=%s",
                        (at, query_id, link_id))
    conn.commit()
    return visit_id, url


def session_of(conn, visit_id):
    with conn.cursor() as cur:
        cur.execute("SELECT session_id FROM link_visits WHERE visit_id=%s", (visit_id,))
        return cur.fetchone()[0]


def refresh(conn, link_id=None, at=None):
    """Recompute ranking evidence and lifecycle state. With link_id: just that link (cheap, used after each report).
    Without: every link (the periodic maintenance job; see maintenance.py)."""
    with conn.cursor() as cur:
        cur.execute("SELECT refresh_website_ranking(%s, COALESCE(%s, now()))", (link_id, at))
        cur.execute("SELECT * FROM refresh_link_states(COALESCE(%s, now()), %s)", (at, link_id))
        changes = cur.fetchall()
    conn.commit()
    return changes


def propose_link(conn, base_link_id, final_url, user_id, allow_demo=False, at=None):
    """A user says they finished on a deeper page. Save a cleaned version as a candidate; never trust it blindly."""
    clean = normalize_url(final_url)
    with conn.cursor() as cur:
        cur.execute("SELECT pattern, kind FROM allowed_domains")
        if not domain_allowed(host_of(clean), cur.fetchall(), allow_demo):
            return None, "domain is not on the government allowlist"
        cur.execute("""SELECT l.website_id, l.category_id, l.title, l.action, w.domain FROM website_links l
                       JOIN websites w USING (website_id) WHERE l.link_id=%s""", (base_link_id,))
        website_id, category_id, title, action, domain = cur.fetchone()
        same_site = host_of(clean) == domain.lower() or (allow_demo and host_of(clean) in LOOPBACK)
        if not same_site:
            return None, "page is on a different website than the link that was used"
        cur.execute("SELECT link_id, url FROM website_links WHERE website_id=%s", (website_id,))
        for lid, url in cur.fetchall():
            if normalize_url(url) == clean:
                return lid, "already in the catalog"
        cur.execute("""INSERT INTO website_links(website_id, category_id, title, url, action, link_type, source, trust_label, state, created_at, state_changed_at)
                       VALUES (%s,%s,%s,%s,%s,'direct_form','community','USER_SUBMITTED','candidate',COALESCE(%s, now()),COALESCE(%s, now()))
                       RETURNING link_id""", (website_id, category_id, f"{title} (community path: {clean.rstrip('/').rsplit('/', 1)[-1]})", clean, action, at, at))
        new_id = cur.fetchone()[0]
        cur.execute("""INSERT INTO link_feedback(user_id, link_id, query_id, useful, outcome, proof_type, proof_ref, created_at)
                       VALUES (%s,%s,NULL,NULL,'success','final_url',%s,COALESCE(%s, now()))""", (user_id, new_id, clean, at))
    conn.commit()
    return new_id, "added as a candidate"


def record_outcome(conn, visit_id, outcome, proof_type="none", proof_ref=None, final_url=None, at=None, allow_demo=False):
    assert outcome in ("success", "failed", "broken", "wrong_page")
    with conn.cursor() as cur:
        cur.execute("""SELECT v.session_id, v.link_id, s.user_id, s.query_id FROM link_visits v
                       JOIN website_sessions s USING (session_id) WHERE v.visit_id=%s""", (visit_id,))
        session_id, link_id, user_id, query_id = cur.fetchone()
        cur.execute("""UPDATE link_visits SET closed_at=GREATEST(opened_at, COALESCE(%s, now())), success_signal=%s,
                       completed_action=%s WHERE visit_id=%s""", (at, outcome, outcome == "success", visit_id))
        cur.execute("UPDATE website_sessions SET ended_at=GREATEST(started_at, COALESCE(%s, now())), exit_reason=%s WHERE session_id=%s",
                    (at, "outcome_reported", session_id))
        # useful stays NULL: the outcome is a usage signal (link_visits). Explicit opinions come from give_feedback().
        cur.execute("""INSERT INTO link_feedback(user_id, query_id, link_id, useful, outcome, proof_type, proof_ref, created_at)
                       VALUES (%s,%s,%s,NULL,%s,%s,%s,COALESCE(%s, now()))
                       ON CONFLICT (user_id, link_id, query_id) DO UPDATE SET outcome=EXCLUDED.outcome""",
                    (user_id, query_id, link_id, outcome, proof_type, proof_ref, at))
    conn.commit()
    proposed = None
    if outcome == "success" and final_url:
        proposed = propose_link(conn, link_id, final_url, user_id, allow_demo, at)
    refresh(conn, link_id, at)          # only this link; the full pass runs as a scheduled job
    return {"link_id": link_id, "proposed": proposed}


def vote(conn, user_id, link_id, v, query_id=None, at=None):
    with conn.cursor() as cur:
        cur.execute("SELECT website_id FROM website_links WHERE link_id=%s", (link_id,))
        website_id = cur.fetchone()[0]
        cur.execute("""INSERT INTO website_votes(user_id, website_id, link_id, query_id, vote, created_at)
                       VALUES (%s,%s,%s,%s,%s,COALESCE(%s, now()))
                       ON CONFLICT (user_id, COALESCE(link_id,0), COALESCE(website_id,0), COALESCE(query_id,0))
                       DO UPDATE SET vote=EXCLUDED.vote""", (user_id, website_id, link_id, query_id, v, at))
    conn.commit()


def give_feedback(conn, user_id, link_id, query_id=None, useful=None, rating=None, problem_solved=None, comment=None, at=None):
    """Explicit opinion about a link (the 'feedback quality' signal). problem_solved should only be set once the
    outcome of the underlying complaint is actually known."""
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO link_feedback(user_id, query_id, link_id, useful, problem_solved, rating, comment, created_at)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,COALESCE(%s, now()))
                       ON CONFLICT (user_id, link_id, query_id) DO UPDATE SET
                         useful=COALESCE(EXCLUDED.useful, link_feedback.useful),
                         rating=COALESCE(EXCLUDED.rating, link_feedback.rating),
                         problem_solved=COALESCE(EXCLUDED.problem_solved, link_feedback.problem_solved),
                         comment=COALESCE(EXCLUDED.comment, link_feedback.comment)""",
                    (user_id, query_id, link_id, useful, problem_solved, rating, comment, at))
    conn.commit()
