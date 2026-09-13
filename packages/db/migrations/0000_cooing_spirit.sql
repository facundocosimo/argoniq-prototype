CREATE TYPE "public"."answer_mode" AS ENUM('A', 'B', 'C', 'D', 'E', 'F');--> statement-breakpoint
CREATE TYPE "public"."confidence_band" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."config_source" AS ENUM('as_built', 'serial_master', 'customer_reported', 'inferred', 'default');--> statement-breakpoint
CREATE TYPE "public"."knowledge_tier" AS ENUM('T1', 'T2', 'T3', 'T4');--> statement-breakpoint
CREATE TYPE "public"."safety_zone" AS ENUM('GREEN', 'YELLOW', 'RED');--> statement-breakpoint
CREATE TYPE "public"."serial_status" AS ENUM('active', 'in_service', 'decommissioned');--> statement-breakpoint
CREATE TYPE "public"."symptom_status" AS ENUM('active', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'awaiting_customer', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."variant_data_type" AS ENUM('enum', 'number', 'boolean', 'string');--> statement-breakpoint
CREATE TYPE "public"."document_source_type" AS ENUM('manual_pdf', 'structured_export', 'ticket_history', 'field_photo', 'service_bulletin');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('uploaded', 'processing', 'ingested', 'failed');--> statement-breakpoint
CREATE TYPE "public"."playbook_status" AS ENUM('draft', 'in_review', 'published', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('support_technician', 'spare_parts', 'field_engineer', 'documentation', 'support_manager', 'admin', 'site_admin', 'operator');--> statement-breakpoint
CREATE TYPE "public"."audit_kind" AS ENUM('access', 'ai_decision', 'safety');--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(63) NOT NULL,
	"name" varchar(200) NOT NULL,
	"brand_accent_color" varchar(7),
	"region" varchar(64) DEFAULT 'eu-central-1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(63) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"country_code" char(2),
	"timezone" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" varchar(63) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"key" varchar(63) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variant_axes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"key" varchar(63) NOT NULL,
	"label" varchar(200) NOT NULL,
	"data_type" "variant_data_type" NOT NULL,
	"options" jsonb,
	"unit" varchar(32),
	"safety_relevant" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"serial_number" varchar(100) NOT NULL,
	"option_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"firmware_version" varchar(100),
	"installed_at" timestamp with time zone,
	"commissioned_at" timestamp with time zone,
	"status" serial_status DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"tier" "knowledge_tier" NOT NULL,
	"page" integer,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"contextual_text" text,
	"embedding" vector(1024),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tier" "knowledge_tier" NOT NULL,
	"source_type" "document_source_type" NOT NULL,
	"title" varchar(400) NOT NULL,
	"family_id" uuid,
	"customer_id" uuid,
	"serial_id" uuid,
	"storage_key" varchar(1024) NOT NULL,
	"page_count" integer,
	"status" "document_status" DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symptoms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"key" varchar(100) NOT NULL,
	"path" varchar(200) NOT NULL,
	"label" varchar(300) NOT NULL,
	"context_qualifiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "symptom_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"model_id" uuid,
	"symptom_id" uuid NOT NULL,
	"key" varchar(100) NOT NULL,
	"title" varchar(300) NOT NULL,
	"status" "playbook_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"candidate_causes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"linked_document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"authored_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"safety_reviewed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"serial_id" uuid,
	"symptom_id" uuid,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"summary" text NOT NULL,
	"internal_note" text,
	"ranked_causes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_part_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answer_mode" "answer_mode",
	"safety_zone" "safety_zone",
	"confidence" "confidence_band",
	"ai_assisted" boolean DEFAULT false NOT NULL,
	"confirmed_root_cause_key" varchar(100),
	"part_used_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"customer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"correlation_id" varchar(64),
	"user_id" uuid,
	"kind" "audit_kind" NOT NULL,
	"action" varchar(100) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_families" ADD CONSTRAINT "machine_families_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_models" ADD CONSTRAINT "machine_models_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_models" ADD CONSTRAINT "machine_models_family_id_machine_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."machine_families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_axes" ADD CONSTRAINT "variant_axes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_axes" ADD CONSTRAINT "variant_axes_model_id_machine_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."machine_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_family_id_machine_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."machine_families"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_model_id_machine_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."machine_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_family_id_machine_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."machine_families"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_serial_id_serials_id_fk" FOREIGN KEY ("serial_id") REFERENCES "public"."serials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_family_id_machine_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."machine_families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_family_id_machine_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."machine_families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_model_id_machine_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."machine_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_symptom_id_symptoms_id_fk" FOREIGN KEY ("symptom_id") REFERENCES "public"."symptoms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_serial_id_serials_id_fk" FOREIGN KEY ("serial_id") REFERENCES "public"."serials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_symptom_id_symptoms_id_fk" FOREIGN KEY ("symptom_id") REFERENCES "public"."symptoms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_uq" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_slug_uq" ON "customers" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "sites_tenant_idx" ON "sites" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sites_customer_idx" ON "sites" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "machine_families_tenant_idx" ON "machine_families" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "machine_families_tenant_key_uq" ON "machine_families" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "machine_models_tenant_idx" ON "machine_models" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "machine_models_family_idx" ON "machine_models" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "machine_models_tenant_key_uq" ON "machine_models" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "variant_axes_tenant_idx" ON "variant_axes" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_axes_model_key_uq" ON "variant_axes" USING btree ("model_id","key");--> statement-breakpoint
CREATE INDEX "serials_tenant_idx" ON "serials" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "serials_customer_idx" ON "serials" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "serials_model_idx" ON "serials" USING btree ("model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "serials_tenant_serial_number_uq" ON "serials" USING btree ("tenant_id","serial_number");--> statement-breakpoint
CREATE INDEX "document_chunks_tenant_idx" ON "document_chunks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "document_chunks_document_idx" ON "document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_chunks_tenant_tier_idx" ON "document_chunks" USING btree ("tenant_id","tier");--> statement-breakpoint
CREATE INDEX "documents_tenant_idx" ON "documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "documents_tenant_tier_idx" ON "documents" USING btree ("tenant_id","tier");--> statement-breakpoint
CREATE INDEX "documents_family_idx" ON "documents" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "symptoms_tenant_idx" ON "symptoms" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "symptoms_family_idx" ON "symptoms" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "symptoms_tenant_key_uq" ON "symptoms" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "playbooks_tenant_idx" ON "playbooks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "playbooks_symptom_idx" ON "playbooks" USING btree ("symptom_id");--> statement-breakpoint
CREATE UNIQUE INDEX "playbooks_tenant_key_version_uq" ON "playbooks" USING btree ("tenant_id","key","version");--> statement-breakpoint
CREATE INDEX "tickets_tenant_idx" ON "tickets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tickets_tenant_status_idx" ON "tickets" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "tickets_serial_idx" ON "tickets" USING btree ("serial_id");--> statement-breakpoint
CREATE INDEX "memberships_tenant_idx" ON "memberships" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_tenant_user_uq" ON "memberships" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "audit_log_tenant_idx" ON "audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_log_correlation_idx" ON "audit_log" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "audit_log_kind_idx" ON "audit_log" USING btree ("kind");