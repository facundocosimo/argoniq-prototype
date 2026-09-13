-- Document audience/ownership invariants, aligned with DocumentScope and schema.
-- Applied transactionally by the existing Drizzle migration runner. Constraints
-- validate ALL existing rows: an invalid legacy row aborts the migration with its
-- named constraint. No silent relabeling, deletion, NULL backfill or NOT VALID gap.
-- Review/correct the offending scope explicitly, then retry the full migration.
--
-- Composite references include tenant and coupled ownership/catalog fields.
-- MATCH SIMPLE deliberately permits omitted optional scopes; the CHECK requires
-- company whenever serial/installation is supplied. RESTRICT blocks referenced
-- ownership changes and deletion instead of clearing scopes or cascading documents.
-- Deleting a document still removes its own scope links and chunks.
-- Run through pnpm db:migrate against a deliberately selected migrated database;
-- do not execute individual statements or treat the array-backed preview as proof.

CREATE UNIQUE INDEX "companies_tenant_id_uq" ON "companies" ("tenant_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "machine_families_tenant_id_uq" ON "machine_families" ("tenant_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "machine_models_tenant_id_uq" ON "machine_models" ("tenant_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "machine_models_tenant_id_family_uq" ON "machine_models" ("tenant_id", "id", "family_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "installations_tenant_id_company_uq" ON "installations" ("tenant_id", "id", "company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "serials_tenant_id_company_uq" ON "serials" ("tenant_id", "id", "company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "serials_tenant_id_family_uq" ON "serials" ("tenant_id", "id", "family_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "serials_tenant_id_model_uq" ON "serials" ("tenant_id", "id", "model_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "serials_tenant_id_installation_uq" ON "serials" ("tenant_id", "id", "installation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "documents_tenant_id_uq" ON "documents" ("tenant_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "documents_tenant_id_tier_uq" ON "documents" ("tenant_id", "id", "tier");
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_audience_ownership_ck" CHECK (
  ("tier" <> 'T2' OR "company_id" IS NOT NULL)
  AND ("tier" NOT IN ('T1', 'T3') OR ("company_id" IS NULL AND "serial_id" IS NULL AND "installation_id" IS NULL))
  AND (("serial_id" IS NULL AND "installation_id" IS NULL) OR "company_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "document_scopes" ADD CONSTRAINT "document_scopes_target_ck" CHECK (
  ("scope_type" = 'family' AND "family_id" IS NOT NULL AND "model_id" IS NULL)
  OR ("scope_type" = 'model' AND "model_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "machine_models" DROP CONSTRAINT "machine_models_family_id_machine_families_id_fk";
--> statement-breakpoint
ALTER TABLE "installations" DROP CONSTRAINT "installations_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "serials" DROP CONSTRAINT "serials_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "serials" DROP CONSTRAINT "serials_family_id_machine_families_id_fk";
--> statement-breakpoint
ALTER TABLE "serials" DROP CONSTRAINT "serials_model_id_machine_models_id_fk";
--> statement-breakpoint
ALTER TABLE "serials" DROP CONSTRAINT "serials_installation_id_installations_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_family_id_machine_families_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_model_id_machine_models_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_serial_id_serials_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_installation_id_installations_id_fk";
--> statement-breakpoint
ALTER TABLE "document_scopes" DROP CONSTRAINT "document_scopes_document_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "document_scopes" DROP CONSTRAINT "document_scopes_family_id_machine_families_id_fk";
--> statement-breakpoint
ALTER TABLE "document_scopes" DROP CONSTRAINT "document_scopes_model_id_machine_models_id_fk";
--> statement-breakpoint
ALTER TABLE "document_chunks" DROP CONSTRAINT "document_chunks_document_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "machine_models" ADD CONSTRAINT "machine_models_tenant_family_fk" FOREIGN KEY ("tenant_id", "family_id") REFERENCES "machine_families" ("tenant_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_tenant_company_fk" FOREIGN KEY ("tenant_id", "company_id") REFERENCES "companies" ("tenant_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_tenant_company_fk" FOREIGN KEY ("tenant_id", "company_id") REFERENCES "companies" ("tenant_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_tenant_family_fk" FOREIGN KEY ("tenant_id", "family_id") REFERENCES "machine_families" ("tenant_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_tenant_model_family_fk" FOREIGN KEY ("tenant_id", "model_id", "family_id") REFERENCES "machine_models" ("tenant_id", "id", "family_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_tenant_installation_company_fk" FOREIGN KEY ("tenant_id", "installation_id", "company_id") REFERENCES "installations" ("tenant_id", "id", "company_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_company_fk" FOREIGN KEY ("tenant_id", "company_id") REFERENCES "companies" ("tenant_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_family_fk" FOREIGN KEY ("tenant_id", "family_id") REFERENCES "machine_families" ("tenant_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_model_fk" FOREIGN KEY ("tenant_id", "model_id") REFERENCES "machine_models" ("tenant_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_model_family_fk" FOREIGN KEY ("tenant_id", "model_id", "family_id") REFERENCES "machine_models" ("tenant_id", "id", "family_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_serial_company_fk" FOREIGN KEY ("tenant_id", "serial_id", "company_id") REFERENCES "serials" ("tenant_id", "id", "company_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_serial_family_fk" FOREIGN KEY ("tenant_id", "serial_id", "family_id") REFERENCES "serials" ("tenant_id", "id", "family_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_serial_model_fk" FOREIGN KEY ("tenant_id", "serial_id", "model_id") REFERENCES "serials" ("tenant_id", "id", "model_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_installation_company_fk" FOREIGN KEY ("tenant_id", "installation_id", "company_id") REFERENCES "installations" ("tenant_id", "id", "company_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_serial_installation_fk" FOREIGN KEY ("tenant_id", "serial_id", "installation_id") REFERENCES "serials" ("tenant_id", "id", "installation_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "document_scopes" ADD CONSTRAINT "document_scopes_tenant_document_fk" FOREIGN KEY ("tenant_id", "document_id") REFERENCES "documents" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "document_scopes" ADD CONSTRAINT "document_scopes_tenant_family_fk" FOREIGN KEY ("tenant_id", "family_id") REFERENCES "machine_families" ("tenant_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "document_scopes" ADD CONSTRAINT "document_scopes_tenant_model_fk" FOREIGN KEY ("tenant_id", "model_id") REFERENCES "machine_models" ("tenant_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "document_scopes" ADD CONSTRAINT "document_scopes_tenant_model_family_fk" FOREIGN KEY ("tenant_id", "model_id", "family_id") REFERENCES "machine_models" ("tenant_id", "id", "family_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_tenant_document_tier_fk" FOREIGN KEY ("tenant_id", "document_id", "tier") REFERENCES "documents" ("tenant_id", "id", "tier") ON DELETE CASCADE ON UPDATE RESTRICT;
