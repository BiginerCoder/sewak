CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"author" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "confirmations" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"resident" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"phase" text NOT NULL,
	"caption" text NOT NULL,
	"image_url" text,
	"added_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'problem' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"stage" integer DEFAULT 1 NOT NULL,
	"author" text NOT NULL,
	"location_text" text NOT NULL,
	"location_simulated" boolean DEFAULT true NOT NULL,
	"department" text,
	"complaint_ref" text,
	"authority_note" text,
	"affected_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"stage" integer NOT NULL,
	"label" text NOT NULL,
	"note" text,
	"actor" text NOT NULL,
	"source" text DEFAULT 'resident' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"resident" text NOT NULL,
	"verdict" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "comments_issue" ON "comments" USING btree ("issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "confirmations_issue_resident" ON "confirmations" USING btree ("issue_id","resident");--> statement-breakpoint
CREATE INDEX "evidence_issue" ON "evidence" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "timeline_issue" ON "timeline_events" USING btree ("issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verifications_issue_resident" ON "verifications" USING btree ("issue_id","resident");