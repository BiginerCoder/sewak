-- Government Service Discovery: normalized PostgreSQL schema
-- One generic table per concept. No per-state tables: scope is expressed by foreign keys.
-- Raw evidence (votes, feedback, visits, health checks) is immutable; ranking numbers are derived.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------- geography
CREATE TABLE countries (
  country_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_code  TEXT NOT NULL UNIQUE,
  country_name  TEXT NOT NULL
);
CREATE TABLE states (
  state_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_id  BIGINT NOT NULL REFERENCES countries,
  state_code  TEXT NOT NULL,
  state_name  TEXT NOT NULL,
  UNIQUE (country_id, state_code),
  UNIQUE (country_id, state_name)
);
CREATE TABLE districts (
  district_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  state_id       BIGINT NOT NULL REFERENCES states,
  district_code  TEXT,
  district_name  TEXT NOT NULL,
  UNIQUE (state_id, district_name)
);
CREATE TABLE local_bodies (
  local_body_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  district_id    BIGINT NOT NULL REFERENCES districts,
  body_type      TEXT NOT NULL CHECK (body_type IN
                 ('municipal_corporation','municipality','nagar_panchayat','gram_panchayat','cantonment','other')),
  body_name      TEXT NOT NULL,
  UNIQUE (district_id, body_name)
);
CREATE TABLE wards (
  ward_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  local_body_id  BIGINT NOT NULL REFERENCES local_bodies,
  ward_number    TEXT NOT NULL,
  ward_name      TEXT,
  UNIQUE (local_body_id, ward_number)
);

-- ---------------------------------------------------------------- government organisation
CREATE TABLE departments (
  department_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  department_name  TEXT NOT NULL UNIQUE,
  department_level TEXT NOT NULL CHECK (department_level IN ('country','state','district','local_body','ward'))
);
CREATE TABLE positions (
  position_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  department_id    BIGINT NOT NULL REFERENCES departments,
  position_name    TEXT NOT NULL,
  responsibilities TEXT,
  UNIQUE (department_id, position_name)
);
CREATE TABLE officials (
  official_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_code  TEXT UNIQUE,
  name           TEXT NOT NULL,
  phone          TEXT,
  email          TEXT
);
CREATE TABLE official_assignments (
  assignment_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  official_id    BIGINT NOT NULL REFERENCES officials,
  position_id    BIGINT NOT NULL REFERENCES positions,
  state_id       BIGINT REFERENCES states,
  district_id    BIGINT REFERENCES districts,
  local_body_id  BIGINT REFERENCES local_bodies,
  ward_id        BIGINT REFERENCES wards,
  start_date     DATE NOT NULL,
  end_date       DATE,
  is_current     BOOLEAN NOT NULL DEFAULT true,
  CHECK (end_date IS NULL OR end_date >= start_date),
  CHECK (num_nonnulls(state_id, district_id, local_body_id, ward_id) >= 1)
);

-- ---------------------------------------------------------------- problem taxonomy
CREATE TABLE problem_categories (
  category_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_category_id  BIGINT REFERENCES problem_categories,
  category_name       TEXT NOT NULL UNIQUE,
  department_id       BIGINT REFERENCES departments,
  is_fallback         BOOLEAN NOT NULL DEFAULT false   -- generic grievance category
);
CREATE TABLE keywords (
  keyword_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  keyword             TEXT NOT NULL,
  normalized_keyword  TEXT NOT NULL,
  language            TEXT NOT NULL DEFAULT 'en',      -- en, hi, hi-Latn ...
  UNIQUE (normalized_keyword, language)
);
CREATE TABLE category_keywords (
  category_id  BIGINT NOT NULL REFERENCES problem_categories,
  keyword_id   BIGINT NOT NULL REFERENCES keywords,
  weight       NUMERIC NOT NULL DEFAULT 1 CHECK (weight BETWEEN 0 AND 1),
  PRIMARY KEY (category_id, keyword_id)
);

-- ---------------------------------------------------------------- users and queries
CREATE TABLE users (
  user_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          TEXT UNIQUE,
  phone          TEXT UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN
                 ('citizen','admin','gov_data_admin','operator','security','analyst')),
  is_suspended   BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE user_queries (
  query_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id              BIGINT REFERENCES users,
  query_text           TEXT NOT NULL,
  detected_category_id BIGINT REFERENCES problem_categories,
  state_id             BIGINT REFERENCES states,
  district_id          BIGINT REFERENCES districts,
  local_body_id        BIGINT REFERENCES local_bodies,
  ward_id              BIGINT REFERENCES wards,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_queries_user_created ON user_queries (user_id, created_at);
CREATE TABLE query_keywords (
  query_id          BIGINT NOT NULL REFERENCES user_queries ON DELETE CASCADE,
  keyword_id        BIGINT NOT NULL REFERENCES keywords,
  confidence_score  NUMERIC NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  PRIMARY KEY (query_id, keyword_id)
);

-- ---------------------------------------------------------------- website and direct-link knowledge base
CREATE TABLE websites (
  website_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  website_name        TEXT NOT NULL,
  domain              TEXT NOT NULL UNIQUE CHECK (domain = lower(domain)),
  base_url            TEXT NOT NULL,
  organization_name   TEXT,
  website_type        TEXT NOT NULL CHECK (website_type IN
                      ('state_portal','district_portal','municipal','department','complaint','service','central_portal')),
  official_status     BOOLEAN NOT NULL DEFAULT false,
  last_verified_at    TIMESTAMPTZ,
  verification_source TEXT,
  status              BOOLEAN NOT NULL DEFAULT true,
  is_demo             BOOLEAN NOT NULL DEFAULT false
);
-- Nullable scope columns. Most specific non-null column wins: ward > local body > district > state > country.
CREATE TABLE website_locations (
  website_location_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  website_id          BIGINT NOT NULL REFERENCES websites ON DELETE CASCADE,
  country_id          BIGINT REFERENCES countries,
  state_id            BIGINT REFERENCES states,
  district_id         BIGINT REFERENCES districts,
  local_body_id       BIGINT REFERENCES local_bodies,
  ward_id             BIGINT REFERENCES wards,
  priority            INT NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  CHECK (num_nonnulls(country_id, state_id, district_id, local_body_id, ward_id) >= 1)
);
CREATE INDEX website_locations_scope ON website_locations (state_id, district_id, local_body_id, ward_id);
CREATE TABLE website_categories (
  website_id   BIGINT NOT NULL REFERENCES websites ON DELETE CASCADE,
  category_id  BIGINT NOT NULL REFERENCES problem_categories,
  relevance    NUMERIC NOT NULL DEFAULT 1 CHECK (relevance BETWEEN 0 AND 1),
  priority     INT NOT NULL DEFAULT 0,
  PRIMARY KEY (website_id, category_id)
);
CREATE INDEX website_categories_cat ON website_categories (category_id, website_id);

CREATE TABLE website_links (
  link_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  website_id       BIGINT NOT NULL REFERENCES websites ON DELETE CASCADE,
  category_id      BIGINT NOT NULL REFERENCES problem_categories,
  parent_link_id   BIGINT REFERENCES website_links,
  title            TEXT NOT NULL,
  url              TEXT NOT NULL,
  action           TEXT NOT NULL CHECK (action IN
                   ('file_complaint','track_status','find_contact','apply_service','rti','appeal','info')),
  link_type        TEXT NOT NULL CHECK (link_type IN
                   ('direct_form','landing_page','portal_home','pdf','app_store','phone_only')),
  steps            TEXT,                       -- how to reach the form when a deep link is not possible
  login_required   BOOLEAN NOT NULL DEFAULT false,
  language         TEXT NOT NULL DEFAULT 'en',
  source           TEXT NOT NULL DEFAULT 'curated' CHECK (source IN ('curated','crawler','community')),
  trust_label      TEXT NOT NULL DEFAULT 'USER_SUBMITTED' CHECK (trust_label IN
                   ('OFFICIAL','PLATFORM_VERIFIED','COMMUNITY_VERIFIED','USER_SUBMITTED','UNVERIFIED')),
  state            TEXT NOT NULL DEFAULT 'candidate' CHECK (state IN ('candidate','verified','stale','retired')),
  state_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status           BOOLEAN NOT NULL DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  last_checked_at  TIMESTAMPTZ,
  last_status_code INT,
  content_hash     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (website_id, url)
);
CREATE INDEX website_links_lookup ON website_links (website_id, category_id, status);
CREATE TABLE link_keywords (
  link_id     BIGINT NOT NULL REFERENCES website_links ON DELETE CASCADE,
  keyword_id  BIGINT NOT NULL REFERENCES keywords,
  relevance   NUMERIC NOT NULL DEFAULT 1 CHECK (relevance BETWEEN 0 AND 1),
  PRIMARY KEY (link_id, keyword_id)
);

-- ---------------------------------------------------------------- sessions and visits (evidence)
CREATE TABLE website_sessions (
  session_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES users,
  query_id          BIGINT REFERENCES user_queries,
  website_id        BIGINT REFERENCES websites,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,
  duration_seconds  INT GENERATED ALWAYS AS (extract(epoch FROM (ended_at - started_at))::int) STORED,
  exit_reason       TEXT,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE TABLE link_visits (
  visit_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id        BIGINT NOT NULL REFERENCES website_sessions,
  link_id           BIGINT NOT NULL REFERENCES website_links,
  opened_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at         TIMESTAMPTZ,
  duration_seconds  INT GENERATED ALWAYS AS (extract(epoch FROM (closed_at - opened_at))::int) STORED,
  previous_link_id  BIGINT REFERENCES website_links,
  next_link_id      BIGINT REFERENCES website_links,
  via               TEXT NOT NULL DEFAULT 'redirect' CHECK (via IN ('redirect','webview','extension')),
  completed_action  BOOLEAN,
  success_signal    TEXT NOT NULL DEFAULT 'unknown' CHECK (success_signal IN
                    ('unknown','success','failed','broken','wrong_page')),
  CHECK (closed_at IS NULL OR closed_at >= opened_at)
);
CREATE INDEX link_visits_session ON link_visits (session_id, opened_at);
CREATE INDEX link_visits_link ON link_visits (link_id, success_signal, opened_at);

-- ---------------------------------------------------------------- votes and feedback (evidence)
CREATE TABLE website_votes (
  vote_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users,
  website_id  BIGINT REFERENCES websites,
  link_id     BIGINT REFERENCES website_links,
  query_id    BIGINT REFERENCES user_queries,
  vote        SMALLINT NOT NULL CHECK (vote IN (-1,0,1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (website_id IS NOT NULL OR link_id IS NOT NULL)
);
-- one vote per user per link per query context
CREATE UNIQUE INDEX website_votes_once ON website_votes (user_id, COALESCE(link_id,0), COALESCE(website_id,0), COALESCE(query_id,0));
CREATE INDEX website_votes_link ON website_votes (link_id, created_at);
CREATE INDEX website_votes_site ON website_votes (website_id, created_at);
CREATE TABLE link_feedback (
  feedback_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users,
  query_id        BIGINT REFERENCES user_queries,
  link_id         BIGINT NOT NULL REFERENCES website_links,
  useful          BOOLEAN,
  problem_solved  BOOLEAN,                 -- stays NULL until a case outcome is known
  rating          SMALLINT CHECK (rating BETWEEN 1 AND 5),
  outcome         TEXT CHECK (outcome IN ('success','failed','broken','wrong_page')),
  proof_type      TEXT CHECK (proof_type IN ('complaint_no','screenshot','final_url','none')),
  proof_ref       TEXT,
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, link_id, query_id)
);
CREATE INDEX link_feedback_link ON link_feedback (link_id, problem_solved, created_at);
CREATE TABLE link_flags (
  flag_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  link_id     BIGINT NOT NULL REFERENCES website_links,
  user_id     BIGINT REFERENCES users,
  reason      TEXT NOT NULL CHECK (reason IN ('broken','wrong_page','outdated','unsafe','spam','other')),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- link health (automated checker)
CREATE TABLE allowed_domains (
  pattern  TEXT PRIMARY KEY,               -- '*.gov.in' or an exact host
  kind     TEXT NOT NULL DEFAULT 'government' CHECK (kind IN ('government','demo'))
);
CREATE TABLE link_health_checks (
  check_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  link_id        BIGINT NOT NULL REFERENCES website_links ON DELETE CASCADE,
  checked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ok             BOOLEAN NOT NULL,
  status_code    INT,
  final_url      TEXT,
  redirected     BOOLEAN NOT NULL DEFAULT false,
  page_title     TEXT,
  content_hash   TEXT,
  content_changed BOOLEAN NOT NULL DEFAULT false,
  error          TEXT,
  elapsed_ms     INT,
  inconclusive   BOOLEAN NOT NULL DEFAULT false   -- checker could not reach the network; never counts against the link
);
CREATE INDEX link_health_checks_link ON link_health_checks (link_id, checked_at DESC);
CREATE TABLE link_state_history (
  history_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  link_id      BIGINT NOT NULL REFERENCES website_links ON DELETE CASCADE,
  old_state    TEXT,
  new_state    TEXT NOT NULL,
  reason       TEXT NOT NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- derived data (recomputable)
CREATE TABLE ranking_config (
  key    TEXT PRIMARY KEY,
  value  NUMERIC NOT NULL,
  note   TEXT
);
-- Derived ranking evidence (SRS: website_ranking). Fully recomputable from the raw evidence tables.
-- district_id NULL  = evidence from every context; used by the link lifecycle rules ("does this link work at all?").
-- district_id = N   = evidence gathered by users in that district; used for ranking ("is it the best link HERE?").
CREATE TABLE website_ranking (
  ranking_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  link_id               BIGINT NOT NULL REFERENCES website_links ON DELETE CASCADE,
  district_id           BIGINT REFERENCES districts,
  fb_pos                NUMERIC NOT NULL DEFAULT 0,   -- weighted positive feedback and votes
  fb_n                  NUMERIC NOT NULL DEFAULT 0,   -- weighted total feedback and votes
  use_pos               NUMERIC NOT NULL DEFAULT 0,   -- weighted successful visits
  use_n                 NUMERIC NOT NULL DEFAULT 0,   -- weighted visits with a known outcome
  unique_success_users  INT NOT NULL DEFAULT 0,       -- distinct established users who succeeded
  last_success_at       TIMESTAMPTZ,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX website_ranking_context ON website_ranking (link_id, COALESCE(district_id, 0));

-- ---------------------------------------------------------------- recommendation evidence and audit
CREATE TABLE recommendation_logs (
  recommendation_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  query_id           BIGINT REFERENCES user_queries,
  link_id            BIGINT NOT NULL REFERENCES website_links,
  score              NUMERIC NOT NULL,
  rank               INT NOT NULL,
  components         JSONB,
  displayed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  selected_at        TIMESTAMPTZ
);
CREATE INDEX recommendation_logs_query ON recommendation_logs (query_id, rank);
CREATE TABLE audit_logs (
  audit_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      BIGINT,
  action       TEXT NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE','LOGIN','SECURITY_EVENT')),
  entity_type  TEXT NOT NULL,
  entity_id    BIGINT,
  old_value    JSONB,
  new_value    JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address   INET,            -- security context, subject to the privacy policy and retention rules
  user_agent   TEXT
);

CREATE FUNCTION audit_link_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.url IS DISTINCT FROM OLD.url OR NEW.state IS DISTINCT FROM OLD.state OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_logs(action, entity_type, entity_id, old_value, new_value)
    VALUES ('UPDATE','website_links', OLD.link_id,
            jsonb_build_object('url',OLD.url,'state',OLD.state,'status',OLD.status),
            jsonb_build_object('url',NEW.url,'state',NEW.state,'status',NEW.status));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER website_links_audit AFTER UPDATE ON website_links
  FOR EACH ROW EXECUTE FUNCTION audit_link_change();
