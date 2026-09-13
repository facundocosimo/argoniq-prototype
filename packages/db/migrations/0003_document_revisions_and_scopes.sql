CREATE TYPE "public"."document_scope_type" AS ENUM('family', 'model');--> statement-breakpoint
CREATE TYPE "public"."document_chunk_type" AS ENUM('prose', 'table', 'figure', 'caption');--> statement-breakpoint
CREATE TABLE "document_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"scope_type" "document_scope_type" NOT NULL,
	"family_id" uuid,
	"model_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "doc_key" varchar(120);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "revision_label" varchar(40);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "revision_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "is_current" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "superseded_by_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "effective_from" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "language" varchar(8) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "model_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "file_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "original_filename" varchar(512);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "mime_type" varchar(120);--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "page_end" integer;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "section_path" varchar(120);--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "section_title" varchar(400);--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "chunk_type" "document_chunk_type" DEFAULT 'prose' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "ai_may_cite" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "forbidden_for_customer_facing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document_scopes" ADD CONSTRAINT "document_scopes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_scopes" ADD CONSTRAINT "document_scopes_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_scopes" ADD CONSTRAINT "document_scopes_family_id_machine_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."machine_families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_scopes" ADD CONSTRAINT "document_scopes_model_id_machine_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."machine_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_superseded_by_id_documents_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_model_id_machine_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."machine_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_scopes_tenant_idx" ON "document_scopes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "document_scopes_document_idx" ON "document_scopes" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_scopes_family_idx" ON "document_scopes" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "document_scopes_model_idx" ON "document_scopes" USING btree ("model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_scopes_uq" ON "document_scopes" USING btree ("document_id","family_id","model_id");--> statement-breakpoint
CREATE INDEX "documents_model_idx" ON "documents" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "documents_dockey_idx" ON "documents" USING btree ("tenant_id","doc_key");
