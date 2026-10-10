export const CURRENT_RESIDENT = "Meera Sharma";
export const WARD = { number: 24, name: "Ward 24", locality: "Shastri Nagar", city: "Jaipur" };
export const CASE_BASE = 12300;

export const caseNumber = (id: number) => CASE_BASE + id;

/* ---------- Lifecycle (seven original stages) ---------- */
export type Stage = {
  n: number;
  short: string;
  label: string;
  desc: string;
  tone: "neutral" | "blue" | "amber" | "green";
  source: "resident" | "authority" | "community";
};

export const STAGES: Stage[] = [
  { n: 1, short: "Reported", label: "Reported", desc: "A resident submitted the problem.", tone: "neutral", source: "resident" },
  { n: 2, short: "Confirmed", label: "Community confirmed", desc: "Neighbours confirmed they are affected.", tone: "blue", source: "community" },
  { n: 3, short: "Sent", label: "Sent to authority", desc: "A complaint was lodged with the department.", tone: "blue", source: "resident" },
  { n: 4, short: "Acknowledged", label: "Authority acknowledged", desc: "The department acknowledged the complaint.", tone: "amber", source: "authority" },
  { n: 5, short: "In progress", label: "Work in progress", desc: "Repair or service work has started.", tone: "amber", source: "authority" },
  { n: 6, short: "Authority: resolved", label: "Authority reported resolved", desc: "The authority says it is fixed. Not yet checked by residents.", tone: "amber", source: "authority" },
  { n: 7, short: "Community verified", label: "Community verified resolved", desc: "Residents confirmed the problem is actually fixed.", tone: "green", source: "community" },
];

export const VERIFY_THRESHOLD = 3; // resident "fixed" confirmations needed for stage 7
export const REOPEN_THRESHOLD = 2; // resident "not fixed" reports that reopen the case

export const stageOf = (n: number) => STAGES[Math.min(Math.max(n, 1), 7) - 1];

/* ---------- Categories, departments and resources ---------- */
export type Resource = { label: string; url: string; quality: "official" | "demo" };

export type Category = {
  id: string;
  label: string;
  keywords: string[];
  department: string;
  resources: Resource[];
  evidence: string[];
};

const SAMPARK: Resource = {
  label: "Rajasthan Sampark grievance portal",
  url: "https://sampark.rajasthan.gov.in",
  quality: "official",
};
const MUNI: Resource = {
  label: "Jaipur Municipal Corporation website",
  url: "https://jaipurmc.org",
  quality: "official",
};

export const CATEGORIES: Category[] = [
  {
    id: "roads",
    label: "Roads & potholes",
    keywords: ["pothole", "road", "crater", "asphalt", "speed breaker", "footpath", "pavement", "broken road", "crack"],
    department: "Roads & Public Works (Municipal Corporation)",
    resources: [MUNI, SAMPARK],
    evidence: ["Photo with a landmark or house number in frame", "Approximate size and depth of the damage", "Any accidents or near-misses you know of"],
  },
  {
    id: "streetlights",
    label: "Streetlights",
    keywords: ["streetlight", "street light", "lamp", "dark", "light not working", "lights", "pole", "bulb"],
    department: "Street Lighting (Municipal Corporation)",
    resources: [MUNI, SAMPARK],
    evidence: ["Pole numbers, if painted on the pole", "A night-time photo of the dark stretch", "How many lights are out and since when"],
  },
  {
    id: "sanitation",
    label: "Garbage & sanitation",
    keywords: ["garbage", "waste", "trash", "dump", "litter", "sweep", "dustbin", "bin", "smell", "stink", "rubbish"],
    department: "Sanitation & Solid Waste (Municipal Corporation)",
    resources: [MUNI, SAMPARK],
    evidence: ["Photo of the waste with the street name visible", "Date when collection last happened", "Whether the pile is blocking a road or drain"],
  },
  {
    id: "drainage",
    label: "Drainage & sewage",
    keywords: ["drain", "sewer", "sewage", "overflow", "waterlogging", "waterlog", "manhole", "flood", "clogged", "blocked drain"],
    department: "Drainage & Sewerage (Municipal Corporation)",
    resources: [MUNI, SAMPARK],
    evidence: ["Photo or short video of the overflow", "Exact location of the drain or manhole", "Health or access impact on neighbours"],
  },
  {
    id: "water",
    label: "Water supply",
    keywords: ["water supply", "pipeline", "pipe", "leak", "tap", "no water", "low pressure", "tanker", "contaminated", "borewell"],
    department: "Public Health Engineering Department (PHED)",
    resources: [{ label: "PHED Rajasthan portal", url: "https://phed.rajasthan.gov.in", quality: "official" }, SAMPARK],
    evidence: ["Your water connection or consumer number, if you have one", "Photo of the leak or a water sample", "Times of day when supply fails"],
  },
  {
    id: "electricity",
    label: "Electricity",
    keywords: ["electric", "power cut", "transformer", "wire", "voltage", "outage", "electricity", "meter", "sparking"],
    department: "Electricity Distribution Company (DISCOM)",
    resources: [{ label: "Rajasthan Energy Department", url: "https://energy.rajasthan.gov.in", quality: "official" }, SAMPARK],
    evidence: ["Consumer account number", "Photo of the hazard from a safe distance", "Duration and frequency of the outage"],
  },
  {
    id: "parks",
    label: "Parks & public spaces",
    keywords: ["park", "garden", "swing", "playground", "bench", "tree", "overgrown", "encroach", "public space"],
    department: "Horticulture & Parks (Municipal Corporation)",
    resources: [MUNI, SAMPARK],
    evidence: ["Photos of the damaged equipment or area", "Name of the park or nearest landmark", "Safety risk for children or seniors"],
  },
  {
    id: "other",
    label: "Other civic issue",
    keywords: [],
    department: "Ward office / Municipal Corporation (to be confirmed)",
    resources: [
      MUNI,
      SAMPARK,
      { label: "Ward office walk-in (demo placeholder, not a verified contact)", url: "#", quality: "demo" },
    ],
    evidence: ["A clear photo of the problem", "The exact place and landmark", "How long it has been going on"],
  },
];

export const categoryOf = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

const NORMALIZED_SPACE = /\s+/g;
const NON_WORD = /[^a-z0-9\s]/g;

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  roads: ["pothole", "broken road", "road damage", "crack in road", "asphalt", "speed breaker", "footpath damaged", "bumpy road", "uneven road", "road crater"],
  streetlights: ["dark street", "no light", "lights out", "street lamp", "lamp post", "bulb missing", "dark lane", "night darkness"],
  sanitation: ["garbage pile", "overflowing bin", "trash dumping", "littering", "stink", "smell", "dirty street", "dustbin full", "solid waste", "waste not collected"],
  drainage: ["blocked drain", "waterlogging", "stagnant water", "sewer overflow", "flooded street", "clogged drain", "sewage overflow", "drain choked"],
  water: ["no water", "low pressure", "water shortage", "supply issue", "pipeline leak", "pipe burst", "tap problem", "contaminated water", "water not coming"],
  electricity: ["power cut", "no electricity", "transformer issue", "sparking wire", "voltage problem", "outage", "fuse blown", "electric line damage"],
  parks: ["park broken", "playground damaged", "bench broken", "park encroachment", "garden neglected", "public space issue"],
};

const normalizeTerm = (value: string) => value.toLowerCase().replace(NON_WORD, " ").replace(NORMALIZED_SPACE, " ").trim();

function getObjectiveScore(text: string, categoryId: string) {
  const normalized = normalizeTerm(text);
  const category = categoryOf(categoryId);
  const terms = [...category.keywords, ...(CATEGORY_SYNONYMS[categoryId] ?? [])].map(normalizeTerm).filter(Boolean);
  const matched = [...new Set(terms.filter((term) => normalized.includes(term)))];
  const score = matched.length * 2 + (normalized.includes(category.label.toLowerCase().replace(NON_WORD, " ").replace(NORMALIZED_SPACE, " ")) ? 2 : 0);
  return { matched, score };
}

export function classify(text: string): { id: string; matched: string[] } {
  const sanitized = normalizeTerm(text);
  if (!sanitized) return { id: "other", matched: [] };

  let best = { id: "other", matched: [] as string[], score: 0 };
  for (const c of CATEGORIES) {
    const { matched, score } = getObjectiveScore(sanitized, c.id);
    if (score > best.score || (score === best.score && c.id !== "other" && best.id === "other")) {
      best = { id: c.id, matched, score };
    }
  }

  if (best.id === "other") {
    const fallback = [
      { id: "water", keywords: ["water", "tap", "pipe"] },
      { id: "sanitation", keywords: ["garbage", "trash", "waste", "dump"] },
      { id: "roads", keywords: ["road", "pothole", "street", "lane"] },
      { id: "streetlights", keywords: ["light", "dark", "lamp", "bulb"] },
      { id: "drainage", keywords: ["drain", "sewer", "flood", "overflow"] },
      { id: "electricity", keywords: ["electric", "power", "transformer", "wire"] },
    ];
    for (const entry of fallback) {
      const matched = entry.keywords.filter((keyword) => sanitized.includes(keyword));
      if (matched.length > best.matched.length) {
        best = { id: entry.id, matched, score: matched.length };
      }
    }
  }

  return { id: best.id, matched: best.matched };
}

export function buildDraft(categoryId: string, text: string, resident = CURRENT_RESIDENT) {
  const c = categoryOf(categoryId);
  return `To,
The Officer In-charge
${c.department}
${WARD.city}

Subject: Complaint regarding ${c.label.toLowerCase()} in ${WARD.name}, ${WARD.locality}, ${WARD.city}

Respected Sir/Madam,

I am a resident of ${WARD.name}, ${WARD.locality}, ${WARD.city}. I would like to bring the following problem to your attention:

${text.trim() || "[Describe the problem here]"}

This affects residents of the neighbourhood. I request you to inspect the location, take the necessary action, and share the complaint reference number and expected timeline.

Photos and the exact location are attached.

Yours sincerely,
${resident}
${WARD.name}, ${WARD.locality}, ${WARD.city}`;
}

/* ---------- Feed and case filters ---------- */
export const FEED_FILTERS = [
  { id: "all", label: "All" },
  { id: "problems", label: "Problems" },
  { id: "unresolved", label: "Unresolved" },
  { id: "resolved", label: "Resolved" },
  { id: "information", label: "Information" },
] as const;

export const CASE_FILTERS = [
  { id: "all", label: "All cases" },
  { id: "open", label: "Open" },
  { id: "progress", label: "In progress" },
  { id: "awaiting", label: "Awaiting community verification" },
  { id: "resolved", label: "Resolved" },
] as const;

type Lite = { kind: string; stage: number };

export const isProblem = (i: Lite) => i.kind === "problem";
export const isResolved = (i: Lite) => i.kind === "problem" && i.stage === 7;
export const isUnresolved = (i: Lite) => i.kind === "problem" && i.stage < 7;

export function matchFeedFilter(i: Lite, f: string) {
  switch (f) {
    case "problems":
      return isProblem(i);
    case "unresolved":
      return isUnresolved(i);
    case "resolved":
      return isResolved(i);
    case "information":
      return i.kind === "information";
    default:
      return true;
  }
}

export function matchCaseFilter(i: Lite, f: string) {
  if (!isProblem(i)) return false;
  switch (f) {
    case "open":
      return i.stage < 7;
    case "progress":
      return i.stage >= 3 && i.stage <= 5;
    case "awaiting":
      return i.stage === 6;
    case "resolved":
      return i.stage === 7;
    default:
      return true;
  }
}

export const EVIDENCE_PHASES = [
  { id: "before", label: "Before" },
  { id: "during", label: "During" },
  { id: "after", label: "After" },
] as const;

/* ---------- Time formatting (Asia/Kolkata for stable output) ---------- */
export function timeAgo(d: Date | string) {
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return fmtDate(date);
}

export function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
