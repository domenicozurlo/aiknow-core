CREATE TABLE IF NOT EXISTS "context_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"virtual_path" text NOT NULL,
	"content_hash" text NOT NULL,
	"data" text NOT NULL,
	"media_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'context_asset_project_id_project_id_fk'
	) THEN
		ALTER TABLE "context_asset" ADD CONSTRAINT "context_asset_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "context_asset_projectId_idx" ON "context_asset" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "context_asset_project_path_hash_unique" ON "context_asset" USING btree ("project_id","virtual_path","content_hash");
