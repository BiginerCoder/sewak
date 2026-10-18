CREATE TABLE IF NOT EXISTS "resident_activity" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "event_type" text NOT NULL,
  "issue_id" integer,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resident_activity_issue" ON "resident_activity" USING btree ("issue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resident_activity_email" ON "resident_activity" USING btree ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resident_activity_confirmation_once"
  ON "resident_activity" USING btree ("email", "issue_id")
  WHERE "event_type" = 'confirmation';
--> statement-breakpoint
SELECT setval(
  pg_get_serial_sequence('resident_activity', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM resident_activity), 0), 1000000),
  true
);
