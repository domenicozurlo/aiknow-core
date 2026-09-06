CREATE TABLE "irrifarm_identity" (
	"user_id" text PRIMARY KEY NOT NULL,
	"irrifarm_user_id" integer NOT NULL,
	"username" text NOT NULL,
	"client_id" integer NOT NULL,
	"client_level" integer NOT NULL,
	"user_role" text,
	"reg_id" text,
	"mbo_sns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_validated_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "irrifarm_identity_irrifarm_user_id_unique" UNIQUE("irrifarm_user_id")
);
--> statement-breakpoint
ALTER TABLE "irrifarm_identity" ADD CONSTRAINT "irrifarm_identity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "irrifarm_identity_username_idx" ON "irrifarm_identity" USING btree ("username");