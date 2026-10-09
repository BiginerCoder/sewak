-- Demo seed data. Everything on a *.example domain is a placeholder (is_demo = true).
-- The only real domains are sampark.rajasthan.gov.in and pgportal.gov.in, which are
-- loaded as UNVERIFIED candidates because no platform check has confirmed them yet.

INSERT INTO countries(country_code, country_name) VALUES ('IN','India');
INSERT INTO states(country_id, state_code, state_name)
  SELECT country_id, c, n FROM countries, (VALUES ('RJ','Rajasthan'),('MH','Maharashtra')) v(c,n);
INSERT INTO districts(state_id, district_name)
  SELECT s.state_id, v.d FROM states s JOIN (VALUES ('RJ','Jaipur'),('MH','Pune')) v(sc,d) ON v.sc = s.state_code;
INSERT INTO local_bodies(district_id, body_type, body_name)
  SELECT d.district_id, 'municipal_corporation', v.n FROM districts d
  JOIN (VALUES ('Jaipur','Jaipur Municipal Corporation (demo)'),('Pune','Pune Municipal Corporation (demo)')) v(dn,n) ON v.dn = d.district_name;
INSERT INTO wards(local_body_id, ward_number, ward_name)
  SELECT lb.local_body_id, v.num, v.nm FROM local_bodies lb
  JOIN (VALUES ('Jaipur Municipal Corporation (demo)','24','Shastri Nagar'),
               ('Jaipur Municipal Corporation (demo)','25','Ward 25'),
               ('Pune Municipal Corporation (demo)','7','Ward 7')) v(b,num,nm) ON v.b = lb.body_name;

INSERT INTO departments(department_name, department_level) VALUES
 ('Water Supply','local_body'),('Drainage and Sewerage','local_body'),('Public Works','local_body'),
 ('Electrical','local_body'),('Sanitation','local_body'),('Horticulture','local_body');
INSERT INTO positions(department_id, position_name, responsibilities)
  SELECT department_id, 'Zone Engineer (demo)', 'Handles complaints for a zone' FROM departments;

-- ------------------------------------------------------------ problem taxonomy
INSERT INTO problem_categories(category_name, is_fallback) VALUES ('General Grievance', true);
INSERT INTO problem_categories(category_name) VALUES ('Water'),('Roads'),('Streetlights'),('Sanitation'),('Electricity'),('Parks');
INSERT INTO problem_categories(category_name, parent_category_id)
  SELECT v.n, p.category_id FROM (VALUES
    ('Water Supply','Water'),('Water Connection','Water'),('Leakage','Water'),('Water Quality','Water'),('Sewerage','Water'),
    ('Potholes','Roads'),('Garbage Collection','Sanitation'),
    ('Power Cut','Electricity'),('New Connection','Electricity'),('Billing','Electricity'),('Transformer','Electricity')) v(n,pn)
  JOIN problem_categories p ON p.category_name = v.pn;

INSERT INTO keywords(keyword, normalized_keyword, language)
SELECT k, k, l FROM (VALUES
 ('water','en'),('supply','en'),('tap','en'),('paani','hi-Latn'),('nal','hi-Latn'),('tanker','en'),('pressure','en'),
 ('leak','en'),('leakage','en'),('burst','en'),('pipe','en'),('pipeline','en'),('connection','en'),
 ('dirty','en'),('contaminated','en'),
 ('drain','en'),('drainage','en'),('sewage','en'),('sewer','en'),('nali','hi-Latn'),('nala','hi-Latn'),
 ('gutter','en'),('manhole','en'),('overflow','en'),('overflowing','en'),
 ('road','en'),('pothole','en'),('potholes','en'),('sadak','hi-Latn'),('gaddha','hi-Latn'),('crack','en'),('footpath','en'),
 ('streetlight','en'),('lamp','en'),('pole','en'),('andhera','hi-Latn'),('light','en'),('dark','en'),
 ('garbage','en'),('waste','en'),('trash','en'),('kachra','hi-Latn'),('dustbin','en'),('dump','en'),('smell','en'),
 ('transformer','en'),('meter','en'),('power','en'),('electricity','en'),('bijli','hi-Latn'),('outage','en'),('bill','en'),('billing','en'),
 ('park','en'),('garden','en'),('swing','en'),('bench','en'),('playground','en')) v(k,l);

INSERT INTO category_keywords(category_id, keyword_id, weight)
SELECT c.category_id, k.keyword_id, v.w FROM (VALUES
 ('Water Supply','water',.5),('Water Supply','supply',.6),('Water Supply','tap',.6),('Water Supply','paani',.6),
 ('Water Supply','nal',.5),('Water Supply','tanker',.6),('Water Supply','pressure',.5),
 ('Water','water',.3),('Water','paani',.3),
 ('Leakage','leak',.8),('Leakage','leakage',.8),('Leakage','burst',.7),('Leakage','pipe',.5),('Leakage','pipeline',.4),
 ('Leakage','water',.2),('Leakage','paani',.2),
 ('Water Connection','connection',.7),('Water Connection','pipeline',.2),('Water Connection','water',.2),('Water Connection','nal',.3),
 ('Water Quality','dirty',.6),('Water Quality','contaminated',.8),('Water Quality','water',.2),('Water Quality','paani',.2),
 ('Sewerage','drain',.7),('Sewerage','drainage',.7),('Sewerage','sewage',.8),('Sewerage','sewer',.8),('Sewerage','nali',.8),
 ('Sewerage','nala',.7),('Sewerage','gutter',.7),('Sewerage','manhole',.8),('Sewerage','overflow',.5),
 ('Sewerage','overflowing',.5),('Sewerage','smell',.3),
 ('Roads','road',.6),('Roads','sadak',.7),('Roads','crack',.5),('Roads','footpath',.6),
 ('Potholes','pothole',.9),('Potholes','potholes',.9),('Potholes','gaddha',.9),('Potholes','road',.3),
 ('Streetlights','streetlight',.9),('Streetlights','lamp',.7),('Streetlights','pole',.6),('Streetlights','andhera',.7),
 ('Streetlights','light',.5),('Streetlights','dark',.5),
 ('Power Cut','power',.6),('Power Cut','electricity',.6),('Power Cut','bijli',.7),('Power Cut','outage',.8),('Power Cut','light',.3),
 ('New Connection','connection',.4),('New Connection','electricity',.3),('New Connection','bijli',.3),('New Connection','meter',.6),
 ('Transformer','transformer',.9),('Transformer','bijli',.2),
 ('Billing','bill',.7),('Billing','billing',.8),('Billing','electricity',.2),('Billing','bijli',.2),
 ('Garbage Collection','garbage',.9),('Garbage Collection','waste',.7),('Garbage Collection','trash',.8),
 ('Garbage Collection','kachra',.9),('Garbage Collection','dustbin',.7),('Garbage Collection','dump',.6),
 ('Garbage Collection','smell',.4),('Sanitation','dustbin',.3),('Sanitation','waste',.3),
 ('Parks','park',.9),('Parks','garden',.7),('Parks','swing',.8),('Parks','bench',.6),('Parks','playground',.8)
) v(cat,kw,w)
JOIN problem_categories c ON c.category_name = v.cat
JOIN keywords k ON k.normalized_keyword = v.kw;

-- ------------------------------------------------------------ websites
INSERT INTO websites(website_name, domain, base_url, organization_name, website_type, official_status,
                     last_verified_at, verification_source, is_demo) VALUES
 ('Rajasthan Sampark','sampark.rajasthan.gov.in','https://sampark.rajasthan.gov.in/','Government of Rajasthan','state_portal',true,
  NULL,'listed in project notes; not yet verified by the platform',false),
 ('CPGRAMS (central grievances)','pgportal.gov.in','https://pgportal.gov.in/','Government of India','central_portal',true,
  NULL,'listed in project notes; not yet verified by the platform',false),
 ('Jaipur Municipal Corporation (DEMO)','jaipurmc.example','https://jaipurmc.example/','Jaipur Municipal Corporation','municipal',true,
  now() - interval '20 days','demo data',true),
 ('Jaipur Water Department (DEMO)','jaipur-water.example','https://jaipur-water.example/','Water Department','department',true,
  now() - interval '20 days','demo data',true),
 ('Rajasthan Power Utility (DEMO)','rajasthan-power.example','https://rajasthan-power.example/','State power utility','department',true,
  now() - interval '20 days','demo data',true),
 ('Pune Municipal Corporation (DEMO)','pune-pmc.example','https://pune-pmc.example/','Pune Municipal Corporation','municipal',true,
  now() - interval '20 days','demo data',true),
 ('National Water Helpline (DEMO)','jal-national.example','https://jal-national.example/','Central water ministry','central_portal',true,
  now() - interval '20 days','demo data',true);

INSERT INTO website_locations(website_id, country_id, state_id, district_id, local_body_id)
SELECT w.website_id,
       CASE WHEN v.lvl = 'country' THEN (SELECT country_id FROM countries) END,
       CASE WHEN v.lvl = 'state' THEN (SELECT state_id FROM states WHERE state_code = v.ref) END,
       CASE WHEN v.lvl = 'district' THEN (SELECT district_id FROM districts WHERE district_name = v.ref) END,
       CASE WHEN v.lvl = 'local_body' THEN (SELECT local_body_id FROM local_bodies WHERE body_name = v.ref) END
FROM websites w JOIN (VALUES
  ('sampark.rajasthan.gov.in','state','RJ'),
  ('pgportal.gov.in','country',''),
  ('jaipurmc.example','local_body','Jaipur Municipal Corporation (demo)'),
  ('jaipur-water.example','district','Jaipur'),
  ('rajasthan-power.example','state','RJ'),
  ('pune-pmc.example','local_body','Pune Municipal Corporation (demo)'),
  ('jal-national.example','country','')) v(dom,lvl,ref) ON v.dom = w.domain;

-- ------------------------------------------------------------ direct links
-- Curated demo links start as 'verified'; the two real portals start as unverified candidates.
INSERT INTO website_links(website_id, category_id, title, url, action, link_type, steps, login_required,
                          trust_label, state, last_verified_at)
SELECT w.website_id, c.category_id, v.title, v.url, v.action, v.ltype, v.steps, v.login,
       v.label, v.st, CASE WHEN v.st = 'verified' THEN now() - interval '20 days' END
FROM (VALUES
 ('sampark.rajasthan.gov.in','General Grievance','Rajasthan Sampark grievance portal','https://sampark.rajasthan.gov.in/','file_complaint','portal_home',
    'Open the portal and look for the option to register a grievance.',false,'UNVERIFIED','candidate'),
 ('pgportal.gov.in','General Grievance','CPGRAMS central grievance portal','https://pgportal.gov.in/','file_complaint','portal_home',
    'Open the portal and choose lodge grievance. Best for central government departments.',false,'UNVERIFIED','candidate'),
 ('jaipurmc.example','Water Supply','Register water supply complaint','https://jaipurmc.example/citizen/water/complaint-form','file_complaint','direct_form',NULL,false,'PLATFORM_VERIFIED','verified'),
 ('jaipurmc.example','Water Supply','Water services','https://jaipurmc.example/citizen/water','info','landing_page','Citizen Services > Water > Complaint',false,'PLATFORM_VERIFIED','verified'),
 ('jaipurmc.example','Water Connection','Apply for new water connection','https://jaipurmc.example/citizen/water/new-connection','apply_service','direct_form',NULL,true,'PLATFORM_VERIFIED','verified'),
 ('jaipurmc.example','Sewerage','Register drainage or sewage complaint','https://jaipurmc.example/citizen/drainage/complaint','file_complaint','direct_form',NULL,false,'PLATFORM_VERIFIED','verified'),
 ('jaipurmc.example','Garbage Collection','Garbage pickup complaint','https://jaipurmc.example/citizen/sanitation/complaint','file_complaint','direct_form',NULL,false,'PLATFORM_VERIFIED','verified'),
 ('jaipurmc.example','Streetlights','Streetlight complaint form','https://jaipurmc.example/citizen/electrical/streetlight','file_complaint','direct_form',NULL,false,'PLATFORM_VERIFIED','verified'),
 ('jaipurmc.example','Potholes','Road repair and pothole complaint','https://jaipurmc.example/citizen/roads','file_complaint','landing_page','Citizen Services > Roads > Report damage',false,'PLATFORM_VERIFIED','verified'),
 ('jaipurmc.example','Water Supply','Water complaint (old portal)','https://jaipurmc.example/old/water-complaint','file_complaint','direct_form',NULL,false,'PLATFORM_VERIFIED','verified'),
 ('jaipur-water.example','Water Supply','File a water supply grievance','https://jaipur-water.example/grievance/new','file_complaint','direct_form',NULL,false,'PLATFORM_VERIFIED','verified'),
 ('jaipur-water.example','Leakage','Report a pipeline leak','https://jaipur-water.example/leak/report','file_complaint','direct_form',NULL,false,'PLATFORM_VERIFIED','verified'),
 ('rajasthan-power.example','Power Cut','Register a power outage','https://rajasthan-power.example/outage/report','file_complaint','direct_form',NULL,false,'PLATFORM_VERIFIED','verified'),
 ('pune-pmc.example','Water Supply','Register water supply complaint','https://pune-pmc.example/water/complaint','file_complaint','direct_form',NULL,false,'PLATFORM_VERIFIED','verified'),
 ('pune-pmc.example','Garbage Collection','Garbage pickup complaint','https://pune-pmc.example/waste/complaint','file_complaint','direct_form',NULL,false,'PLATFORM_VERIFIED','verified'),
 ('jal-national.example','Water Supply','Report a water supply problem (national)','https://jal-national.example/report','file_complaint','direct_form',NULL,false,'PLATFORM_VERIFIED','verified')
) v(dom,cat,title,url,action,ltype,steps,login,label,st)
JOIN websites w ON w.domain = v.dom JOIN problem_categories c ON c.category_name = v.cat;

INSERT INTO website_categories(website_id, category_id)
SELECT DISTINCT website_id, category_id FROM website_links;

INSERT INTO link_keywords(link_id, keyword_id, relevance)
SELECT l.link_id, k.keyword_id, v.r FROM (VALUES
 ('https://jaipurmc.example/citizen/water/complaint-form','supply',.6),('https://jaipurmc.example/citizen/water/complaint-form','tap',.5),
 ('https://jaipurmc.example/citizen/water/complaint-form','paani',.5),
 ('https://jaipurmc.example/old/water-complaint','supply',.6),('https://jaipurmc.example/old/water-complaint','paani',.5),
 ('https://jaipur-water.example/grievance/new','supply',.6),('https://jaipur-water.example/grievance/new','tap',.5),
 ('https://jaipur-water.example/grievance/new','paani',.5),('https://jaipur-water.example/grievance/new','tanker',.4),
 ('https://jaipur-water.example/leak/report','leak',.8),('https://jaipur-water.example/leak/report','pipe',.5),
 ('https://jaipurmc.example/citizen/drainage/complaint','drain',.7),('https://jaipurmc.example/citizen/drainage/complaint','sewage',.7),
 ('https://jaipurmc.example/citizen/drainage/complaint','nali',.7),
 ('https://jaipurmc.example/citizen/sanitation/complaint','garbage',.8),('https://jaipurmc.example/citizen/sanitation/complaint','kachra',.8),
 ('https://jaipurmc.example/citizen/electrical/streetlight','streetlight',.8),('https://jaipurmc.example/citizen/electrical/streetlight','andhera',.6),
 ('https://jaipurmc.example/citizen/roads','pothole',.7),('https://jaipurmc.example/citizen/roads','sadak',.6),
 ('https://rajasthan-power.example/outage/report','bijli',.7),('https://rajasthan-power.example/outage/report','outage',.7),
 ('https://pune-pmc.example/water/complaint','supply',.6),('https://pune-pmc.example/water/complaint','tap',.5)
) v(url,kw,r) JOIN website_links l ON l.url = v.url JOIN keywords k ON k.normalized_keyword = v.kw;

INSERT INTO allowed_domains(pattern, kind) VALUES ('*.gov.in','government'),('*.nic.in','government'),('127.0.0.1','demo');
