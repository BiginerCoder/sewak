import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const vector1024 = customType<{ data: number[]; driverData: string }>({
  dataType: () => "vector(1024)",
  toDriver: (value) => `[${value.join(",")}]`,
  fromDriver: (value) => value.slice(1, -1).split(",").map(Number),
});

export const authProfiles = pgTable("auth_profiles", {
  firebaseUid: text("firebase_uid").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const residentActivity = pgTable(
  "resident_activity",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    eventType: text("event_type").notNull(),
    issueId: integer("issue_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("resident_activity_issue").on(t.issueId),
    index("resident_activity_email").on(t.email),
    uniqueIndex("resident_activity_confirmation_once")
      .on(t.email, t.issueId)
      .where(sql`${t.eventType} = 'confirmation'`),
  ],
);

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
  locationId: text("location_id").notNull().default("jaipur-24"),
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

export const assistantDocuments = pgTable(
  "assistant_documents",
  {
    id: serial("id").primaryKey(),
    sourceKey: text("source_key").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: integer("source_id"),
    category: text("category"),
    area: text("area"),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    embedding: vector1024("embedding").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("assistant_documents_source_key").on(t.sourceKey),
    index("assistant_documents_category").on(t.category),
    index("assistant_documents_embedding_cosine").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);
