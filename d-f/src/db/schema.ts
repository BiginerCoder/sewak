import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * A civic post. `kind` = "problem" posts follow the seven-stage case lifecycle;
 * "information" posts are notices and have no lifecycle.
 */
export const issues = pgTable("issues", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().default("problem"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  stage: integer("stage").notNull().default(1),
  author: text("author").notNull(),
  locationText: text("location_text").notNull(),
  locationSimulated: boolean("location_simulated").notNull().default(true),
  department: text("department"),
  complaintRef: text("complaint_ref"),
  authorityNote: text("authority_note"),
  affectedCount: integer("affected_count").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const confirmations = pgTable(
  "confirmations",
  {
    id: serial("id").primaryKey(),
    issueId: integer("issue_id").notNull(),
    resident: text("resident").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("confirmations_issue_resident").on(t.issueId, t.resident)],
);

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    issueId: integer("issue_id").notNull(),
    author: text("author").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_issue").on(t.issueId)],
);

export const evidence = pgTable(
  "evidence",
  {
    id: serial("id").primaryKey(),
    issueId: integer("issue_id").notNull(),
    phase: text("phase").notNull(), // before | during | after
    caption: text("caption").notNull(),
    imageUrl: text("image_url"),
    addedBy: text("added_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evidence_issue").on(t.issueId)],
);

export const timelineEvents = pgTable(
  "timeline_events",
  {
    id: serial("id").primaryKey(),
    issueId: integer("issue_id").notNull(),
    stage: integer("stage").notNull(),
    label: text("label").notNull(),
    note: text("note"),
    actor: text("actor").notNull(),
    // resident | authority-reported | community | system
    source: text("source").notNull().default("resident"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("timeline_issue").on(t.issueId)],
);

/** Resident feedback on an authority-reported resolution. */
export const verifications = pgTable(
  "verifications",
  {
    id: serial("id").primaryKey(),
    issueId: integer("issue_id").notNull(),
    resident: text("resident").notNull(),
    verdict: text("verdict").notNull(), // fixed | not_fixed
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("verifications_issue_resident").on(t.issueId, t.resident)],
);
