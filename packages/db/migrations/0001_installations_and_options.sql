CREATE TYPE "public"."installation_kind" AS ENUM('line', 'cell', 'skid', 'system');--> statement-breakpoint
CREATE TYPE "public"."option_type" AS ENUM('boolean', 'choice', 'quantity');--> statement-breakpoint
CREATE TYPE "public"."option_constraint_relation" AS ENUM('requires', 'excludes', 'implies');--> statement-breakpoint
CREATE TABLE "installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"parent_id" uuid,
	"kind" "installation_kind" DEFAULT 'line' NOT NULL,
	"key" varchar(63) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"commissioned_at" timestamp with time zone,
	"warranty_expires_at" timestamp with time zone,
	"status" "serial_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_defs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"key" varchar(63) NOT NULL,
	"label" varchar(200) NOT NULL,
	"option_type" "option_type" NOT NULL,
	"choices" jsonb,
	"unit" varchar(32),
	"safety_relevant" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serial_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"serial_id" uuid NOT NULL,
	"option_def_id" uuid NOT NULL,
	"present" boolean DEFAULT true NOT NULL,
	"chosen_value" varchar(200),
	"installed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_constraints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"from_option_id" uuid NOT NULL,
	"relation" "option_constraint_relation" NOT NULL,
	"to_option_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "serials" ADD COLUMN "installation_id" uuid;--> statement-breakpoint
ALTER TABLE "serials" ADD COLUMN "position" integer;--> statement-breakpoint
ALTER TABLE "serials" ADD COLUMN "manufacturer" varchar(200);--> statement-breakpoint
ALTER TABLE "machine_families" ADD COLUMN "icon_key" varchar(63);--> statement-breakpoint
ALTER TABLE "machine_models" ADD COLUMN "image_url" varchar(1024);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "installation_id" uuid;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_parent_id_installations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."installations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_defs" ADD CONSTRAINT "option_defs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_defs" ADD CONSTRAINT "option_defs_model_id_machine_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."machine_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial_options" ADD CONSTRAINT "serial_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial_options" ADD CONSTRAINT "serial_options_serial_id_serials_id_fk" FOREIGN KEY ("serial_id") REFERENCES "public"."serials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial_options" ADD CONSTRAINT "serial_options_option_def_id_option_defs_id_fk" FOREIGN KEY ("option_def_id") REFERENCES "public"."option_defs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_constraints" ADD CONSTRAINT "option_constraints_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_constraints" ADD CONSTRAINT "option_constraints_model_id_machine_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."machine_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_constraints" ADD CONSTRAINT "option_constraints_from_option_id_option_defs_id_fk" FOREIGN KEY ("from_option_id") REFERENCES "public"."option_defs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_constraints" ADD CONSTRAINT "option_constraints_to_option_id_option_defs_id_fk" FOREIGN KEY ("to_option_id") REFERENCES "public"."option_defs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "installations_tenant_idx" ON "installations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "installations_customer_idx" ON "installations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "installations_site_idx" ON "installations" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "installations_parent_idx" ON "installations" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "installations_tenant_key_uq" ON "installations" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "option_defs_tenant_idx" ON "option_defs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "option_defs_model_idx" ON "option_defs" USING btree ("model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "option_defs_model_key_uq" ON "option_defs" USING btree ("model_id","key");--> statement-breakpoint
CREATE INDEX "serial_options_tenant_idx" ON "serial_options" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "serial_options_serial_idx" ON "serial_options" USING btree ("serial_id");--> statement-breakpoint
CREATE UNIQUE INDEX "serial_options_serial_option_uq" ON "serial_options" USING btree ("serial_id","option_def_id");--> statement-breakpoint
CREATE INDEX "option_constraints_tenant_idx" ON "option_constraints" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "option_constraints_model_idx" ON "option_constraints" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "serials_installation_idx" ON "serials" USING btree ("installation_id");
