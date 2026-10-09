-- Ranking, link statistics and link state rules.
-- Everything tunable lives in ranking_config so administrators can change weights without a deploy.

INSERT INTO ranking_config(key, value, note) VALUES
 ('w_feedback',  0.30, 'SRS: feedback quality'),
 ('w_usage',     0.25, 'SRS: successful usage'),
 ('w_relevance', 0.20, 'SRS: link/problem relevance'),
 ('w_location',  0.15, 'SRS: location relevance'),
 ('w_trust',     0.10, 'SRS: official/trust score'),
 ('half_life_days',        90,  'older evidence counts half as much every N days'),
 ('prior_strength',         4,  'pseudo-observations at 50% so one vote cannot dominate'),
 ('min_account_age_days',   3,  'accounts younger than this do not count toward promotion'),
 ('account_ramp_days',     14,  'accounts reach full vote weight after N days'),
 ('stale_multiplier',     0.60, 'score multiplier for stale links'),
 ('candidate_multiplier', 0.80, 'score multiplier for unconfirmed links'),
 ('min_unique_success',      3, 'distinct established users needed to promote a candidate'),
 ('min_positive_ratio',   0.70, 'weighted success ratio needed to promote a candidate'),
 ('stale_after_days',       90, 'verified link with no success in N days becomes stale'),
 ('fail_checks_for_stale',   2, 'consecutive failed health checks that make a link stale'),
 ('broken_reports_for_stale',3, 'distinct users reporting broken/wrong page'),
 ('retire_after_stale_days',60, 'stale this long without recovery becomes retired'),
 ('loc_ward',         1.00, 'location match weights'),
 ('loc_local_body',   0.85, ''),
 ('loc_district',     0.65, ''),
 ('loc_state',        0.45, ''),
 ('loc_country',      0.25, ''),
 ('rel_exact',        1.00, 'category relevance weights'),
 ('rel_child',        0.80, 'link is for a sub-category of the problem'),
 ('rel_parent',       0.60, 'link is for the parent category of the problem'),
 ('rel_fallback',     0.35, 'generic grievance portals');

CREATE FUNCTION cfg(k TEXT) RETURNS NUMERIC LANGUAGE sql STABLE AS
$$ SELECT value FROM ranking_config WHERE key = k $$;

-- exponential time decay of old evidence
CREATE FUNCTION decay(ts TIMESTAMPTZ, p_now TIMESTAMPTZ) RETURNS NUMERIC LANGUAGE sql STABLE AS
$$ SELECT power(0.5, GREATEST(extract(epoch FROM (p_now - ts)) / 86400.0, 0) / cfg('half_life_days')) $$;

-- Accounts younger than min_account_age_days carry NO weight (their evidence is kept and starts
-- counting when the account matures); after that the weight ramps from 0.2 to 1 over account_ramp_days.
CREATE FUNCTION user_weight(created TIMESTAMPTZ, p_now TIMESTAMPTZ) RETURNS NUMERIC LANGUAGE sql STABLE AS
$$ SELECT CASE
     WHEN extract(epoch FROM (p_now - created)) / 86400.0 < cfg('min_account_age_days') THEN 0
     ELSE LEAST(1.0, 0.2 + 0.8 * (extract(epoch FROM (p_now - created)) / 86400.0 - cfg('min_account_age_days'))
                          / GREATEST(cfg('account_ramp_days') - cfg('min_account_age_days'), 1))
   END $$;

-- Wilson lower bound (95%) of a success proportion
CREATE FUNCTION wilson_lb(pos NUMERIC, n NUMERIC) RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS
$$ SELECT CASE WHEN n <= 0 THEN 0 ELSE
     GREATEST(0, ((pos/n) + 1.9208/n - 1.96 * sqrt(((pos/n) * (1 - pos/n) + 0.9604/n) / n)) / (1 + 3.8416/n))
   END $$;

-- Walk up from a ward to its local body, district and state.
CREATE FUNCTION resolve_location(p_ward BIGINT)
RETURNS TABLE(ward_id BIGINT, local_body_id BIGINT, district_id BIGINT, state_id BIGINT) LANGUAGE sql STABLE AS
$$ SELECT w.ward_id, lb.local_body_id, d.district_id, s.state_id
   FROM wards w JOIN local_bodies lb USING (local_body_id)
   JOIN districts d USING (district_id) JOIN states s USING (state_id)
   WHERE w.ward_id = p_ward $$;

-- ---------------------------------------------------------------- derived statistics
-- Feedback quality  = votes + explicit feedback (useful / not useful).
-- Successful usage  = link visits with a known outcome (success / failed / broken / wrong_page).
-- Both are weighted by account maturity and decayed over time. Evidence is bucketed by the district of the
-- query it came from, so a link that works well in one district does not get credit in another (SRS 11.2).
CREATE FUNCTION refresh_website_ranking(p_link BIGINT DEFAULT NULL, p_now TIMESTAMPTZ DEFAULT now())
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
  DELETE FROM website_ranking WHERE p_link IS NULL OR link_id = p_link;
  INSERT INTO website_ranking(link_id, district_id, fb_pos, fb_n, use_pos, use_n, unique_success_users, last_success_at, computed_at)
  WITH
  -- A user's opinion (explicit feedback or vote) counts once per link and district: their latest one.
  fb_ev AS (
    SELECT DISTINCT ON (link_id, uid, district_id) link_id, district_id, 'fb'::text AS kind, good, w, uid,
           false AS established, at
    FROM (
      SELECT f.link_id, q.district_id, f.useful AS good,
             user_weight(u.created_at, p_now) * decay(f.created_at, p_now) AS w, u.user_id AS uid, f.created_at AS at
        FROM link_feedback f JOIN users u USING (user_id) LEFT JOIN user_queries q ON q.query_id = f.query_id
       WHERE f.useful IS NOT NULL AND NOT u.is_suspended AND (p_link IS NULL OR f.link_id = p_link)
      UNION ALL
      SELECT v.link_id, q.district_id, v.vote > 0,
             user_weight(u.created_at, p_now) * decay(v.created_at, p_now), u.user_id, v.created_at
        FROM website_votes v JOIN users u USING (user_id) LEFT JOIN user_queries q ON q.query_id = v.query_id
       WHERE v.link_id IS NOT NULL AND v.vote <> 0 AND NOT u.is_suspended AND (p_link IS NULL OR v.link_id = p_link)
    ) o
    ORDER BY link_id, uid, district_id, at DESC
  ),
  -- Likewise a user's usage counts once per link and district: their latest visit with a known outcome.
  use_ev AS (
    SELECT DISTINCT ON (v.link_id, u.user_id, q.district_id)
           v.link_id, q.district_id, 'use'::text AS kind, v.success_signal = 'success' AS good,
           user_weight(u.created_at, p_now) * decay(v.opened_at, p_now) AS w, u.user_id AS uid,
           (p_now - u.created_at) >= make_interval(days => cfg('min_account_age_days')::int) AS established,
           v.opened_at AS at
      FROM link_visits v JOIN website_sessions s USING (session_id) JOIN users u ON u.user_id = s.user_id
      LEFT JOIN user_queries q ON q.query_id = s.query_id
     WHERE v.success_signal <> 'unknown' AND NOT u.is_suspended AND (p_link IS NULL OR v.link_id = p_link)
     ORDER BY v.link_id, u.user_id, q.district_id, v.opened_at DESC
  ),
  ev AS (SELECT * FROM fb_ev UNION ALL SELECT * FROM use_ev)
  SELECT link_id, CASE WHEN GROUPING(district_id) = 1 THEN NULL ELSE district_id END,
         COALESCE(sum(w) FILTER (WHERE kind = 'fb'  AND good), 0), COALESCE(sum(w) FILTER (WHERE kind = 'fb'), 0),
         COALESCE(sum(w) FILTER (WHERE kind = 'use' AND good), 0), COALESCE(sum(w) FILTER (WHERE kind = 'use'), 0),
         count(DISTINCT uid) FILTER (WHERE kind = 'use' AND good AND established),
         max(at) FILTER (WHERE kind = 'use' AND good), p_now
    FROM ev
   GROUP BY GROUPING SETS ((link_id, district_id), (link_id))
  HAVING GROUPING(district_id) = 1 OR district_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ---------------------------------------------------------------- ranking
CREATE FUNCTION rank_links(
  p_category BIGINT,
  p_state BIGINT DEFAULT NULL, p_district BIGINT DEFAULT NULL,
  p_local_body BIGINT DEFAULT NULL, p_ward BIGINT DEFAULT NULL,
  p_keywords BIGINT[] DEFAULT '{}',
  p_action TEXT DEFAULT NULL,
  p_include_candidates BOOLEAN DEFAULT true,
  p_limit INT DEFAULT 10,
  p_now TIMESTAMPTZ DEFAULT now())
RETURNS TABLE(link_id BIGINT, website_id BIGINT, website_name TEXT, title TEXT, url TEXT, action TEXT,
              link_type TEXT, state TEXT, trust_label TEXT, steps TEXT,
              score NUMERIC, c_feedback NUMERIC, c_usage NUMERIC, c_relevance NUMERIC,
              c_location NUMERIC, c_trust NUMERIC, multiplier NUMERIC, loc_level TEXT)
LANGUAGE sql STABLE AS $$
WITH
cat AS (   -- how close each category is to the problem
  SELECT category_id, max(s) AS s FROM (
    SELECT category_id, cfg('rel_exact') AS s FROM problem_categories WHERE category_id = p_category
    UNION ALL
    SELECT category_id, cfg('rel_child')  FROM problem_categories WHERE parent_category_id = p_category
    UNION ALL
    SELECT parent_category_id, cfg('rel_parent') FROM problem_categories WHERE category_id = p_category AND parent_category_id IS NOT NULL
    UNION ALL
    SELECT category_id, cfg('rel_fallback') FROM problem_categories WHERE is_fallback
  ) z GROUP BY category_id
),
loc AS (   -- best-matching geographic scope per website
  SELECT wl.website_id,
         max(CASE WHEN wl.ward_id IS NOT NULL THEN cfg('loc_ward')
                  WHEN wl.local_body_id IS NOT NULL THEN cfg('loc_local_body')
                  WHEN wl.district_id IS NOT NULL THEN cfg('loc_district')
                  WHEN wl.state_id IS NOT NULL THEN cfg('loc_state')
                  ELSE cfg('loc_country') END) AS s
  FROM website_locations wl
  WHERE wl.is_active
    AND (wl.ward_id IS NULL OR wl.ward_id = p_ward)
    AND (wl.local_body_id IS NULL OR wl.local_body_id = p_local_body)
    AND (wl.district_id IS NULL OR wl.district_id = p_district)
    AND (wl.state_id IS NULL OR wl.state_id = p_state)
  GROUP BY wl.website_id
),
kw AS (
  SELECT lk.link_id, LEAST(1, sum(lk.relevance)) AS s
  FROM link_keywords lk WHERE lk.keyword_id = ANY (p_keywords) GROUP BY lk.link_id
),
base AS (
  SELECT l.*, w.website_name AS wname, w.official_status, w.last_verified_at AS site_verified,
         COALESCE(cat.s,0) AS cat_s, COALESCE(kw.s,0) AS kw_s, loc.s AS loc_s,
         COALESCE(st.fb_pos,0) AS fb_pos, COALESCE(st.fb_n,0) AS fb_n,
         COALESCE(st.use_pos,0) AS use_pos, COALESCE(st.use_n,0) AS use_n
  FROM website_links l
  JOIN websites w ON w.website_id = l.website_id AND w.status
  JOIN loc ON loc.website_id = l.website_id
  LEFT JOIN cat ON cat.category_id = l.category_id
  LEFT JOIN kw ON kw.link_id = l.link_id
  LEFT JOIN website_ranking st ON st.link_id = l.link_id AND st.district_id IS NOT DISTINCT FROM p_district
  WHERE l.status AND l.state <> 'retired'
    AND (p_include_candidates OR l.state <> 'candidate')
    AND cat.s IS NOT NULL            -- the link must belong to the problem's category family
),
scored AS (
  SELECT b.*,
    wilson_lb(b.fb_pos  + cfg('prior_strength')/2, b.fb_n  + cfg('prior_strength')) AS f,
    wilson_lb(b.use_pos + cfg('prior_strength')/2, b.use_n + cfg('prior_strength')) AS u,
    (0.7 * b.cat_s + 0.3 * b.kw_s) * CASE WHEN p_action IS NULL OR b.action = p_action THEN 1 ELSE 0.85 END AS rel,
    (0.5 * CASE WHEN b.official_status THEN 1.0 ELSE 0.3 END
     + 0.3 * GREATEST(0, LEAST(1, 1 - (extract(epoch FROM (p_now - COALESCE(GREATEST(b.last_verified_at, b.site_verified), p_now - interval '400 days'))) / 86400.0 - 30) / 335.0))
     + 0.2 * CASE b.trust_label WHEN 'OFFICIAL' THEN 1.0 WHEN 'PLATFORM_VERIFIED' THEN 0.8
                                WHEN 'COMMUNITY_VERIFIED' THEN 0.6 WHEN 'USER_SUBMITTED' THEN 0.3 ELSE 0.2 END) AS t,
    CASE b.state WHEN 'stale' THEN cfg('stale_multiplier') WHEN 'candidate' THEN cfg('candidate_multiplier') ELSE 1.0 END AS m
  FROM base b
)
SELECT s.link_id, s.website_id, s.wname, s.title, s.url, s.action, s.link_type, s.state, s.trust_label, s.steps,
       round(100 * s.m * (cfg('w_feedback') * s.f + cfg('w_usage') * s.u + cfg('w_relevance') * s.rel
                          + cfg('w_location') * s.loc_s + cfg('w_trust') * s.t), 2) AS score,
       round(s.f,3), round(s.u,3), round(s.rel,3), round(s.loc_s,3), round(s.t,3), s.m,
       CASE WHEN s.loc_s >= cfg('loc_ward') THEN 'ward' WHEN s.loc_s >= cfg('loc_local_body') THEN 'local_body'
            WHEN s.loc_s >= cfg('loc_district') THEN 'district' WHEN s.loc_s >= cfg('loc_state') THEN 'state' ELSE 'country' END
FROM scored s
ORDER BY 11 DESC, s.link_id
LIMIT p_limit
$$;

-- ---------------------------------------------------------------- link lifecycle
-- candidate -> verified (enough independent successes) -> stale (failures / reports / inactivity) -> retired
CREATE FUNCTION refresh_link_states(p_now TIMESTAMPTZ DEFAULT now(), p_link BIGINT DEFAULT NULL)
RETURNS TABLE(link_id BIGINT, old_state TEXT, new_state TEXT, reason TEXT)
LANGUAGE plpgsql AS $$
DECLARE
  r RECORD; target TEXT; why TEXT;
  fail_n INT := cfg('fail_checks_for_stale')::int;
  recent BOOLEAN[]; broken_users INT; good_users INT; open_flags INT; ratio NUMERIC;
BEGIN
  FOR r IN SELECT l.link_id AS id, l.state, l.state_changed_at, l.source, st.unique_success_users AS uniq,
                  st.last_success_at, st.use_pos, st.use_n
           FROM website_links l LEFT JOIN website_ranking st ON st.link_id = l.link_id AND st.district_id IS NULL
           WHERE l.state <> 'retired' AND l.status AND (p_link IS NULL OR l.link_id = p_link)
  LOOP
    target := NULL; why := NULL;
    SELECT array_agg(ok) INTO recent FROM (
      SELECT ok FROM link_health_checks h WHERE h.link_id = r.id AND h.checked_at <= p_now AND NOT h.inconclusive
      ORDER BY checked_at DESC LIMIT GREATEST(fail_n, 2)) q;
    SELECT count(DISTINCT f.user_id) INTO broken_users FROM link_feedback f
      WHERE f.link_id = r.id AND f.outcome IN ('broken','wrong_page') AND f.created_at > p_now - interval '30 days';
    SELECT count(DISTINCT f.user_id) INTO good_users FROM link_feedback f
      WHERE f.link_id = r.id AND f.outcome = 'success' AND f.created_at > p_now - interval '30 days';
    SELECT count(*) INTO open_flags FROM link_flags f WHERE f.link_id = r.id AND f.status = 'open';
    ratio := CASE WHEN COALESCE(r.use_n,0) > 0 THEN r.use_pos / r.use_n ELSE 0 END;

    IF r.state IN ('candidate','verified') THEN
      IF recent IS NOT NULL AND array_length(recent,1) >= fail_n
         AND NOT (SELECT bool_or(x) FROM unnest(recent[1:fail_n]) x) THEN
        target := 'stale'; why := format('last %s health checks failed', fail_n);
      ELSIF broken_users >= cfg('broken_reports_for_stale') AND broken_users > good_users THEN
        target := 'stale'; why := format('%s users reported it broken or wrong in 30 days', broken_users);
      ELSIF r.state = 'verified' AND r.last_success_at IS NOT NULL
            AND r.last_success_at < p_now - make_interval(days => cfg('stale_after_days')::int) THEN
        target := 'stale'; why := format('no successful use for %s days', cfg('stale_after_days'));
      ELSIF r.state = 'candidate' AND COALESCE(r.uniq,0) >= cfg('min_unique_success')
            AND ratio >= cfg('min_positive_ratio') AND open_flags = 0
            AND COALESCE(recent[1], true) THEN
        target := 'verified'; why := format('%s independent successes, ratio %s', r.uniq, round(ratio,2));
      END IF;
    ELSIF r.state = 'stale' THEN
      IF recent IS NOT NULL AND array_length(recent,1) >= 2 AND recent[1] AND recent[2] AND good_users >= 1 THEN
        target := 'verified'; why := 'health checks pass again and users succeeded';
      ELSIF r.state_changed_at < p_now - make_interval(days => cfg('retire_after_stale_days')::int) THEN
        target := 'retired'; why := format('stale for more than %s days', cfg('retire_after_stale_days'));
      END IF;
    END IF;

    IF target IS NOT NULL THEN
      UPDATE website_links w SET state = target, state_changed_at = p_now,
             trust_label = CASE WHEN target = 'verified' AND r.source <> 'curated' AND w.trust_label IN ('UNVERIFIED','USER_SUBMITTED')
                                THEN 'COMMUNITY_VERIFIED' ELSE w.trust_label END,
             last_verified_at = CASE WHEN target = 'verified' THEN p_now ELSE w.last_verified_at END
       WHERE w.link_id = r.id;
      INSERT INTO link_state_history(link_id, old_state, new_state, reason, changed_at)
        VALUES (r.id, r.state, target, why, p_now);
      link_id := r.id; old_state := r.state; new_state := target; reason := why;
      RETURN NEXT;
    END IF;
  END LOOP;
END $$;
