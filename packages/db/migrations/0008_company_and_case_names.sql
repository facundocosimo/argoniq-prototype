-- Align the business vocabulary without rebuilding tables or losing relationships.
ALTER TABLE "customers" RENAME TO "companies";
--> statement-breakpoint
ALTER TABLE "tickets" RENAME TO "cases";
--> statement-breakpoint
ALTER TYPE "ticket_status" RENAME TO "case_status";
--> statement-breakpoint
ALTER TYPE "document_source_type" RENAME VALUE 'ticket_history' TO 'case_history';
--> statement-breakpoint
DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['sites', 'contacts', 'serials', 'installations', 'documents', 'cases', 'memberships'] LOOP
    EXECUTE format('ALTER TABLE %I RENAME COLUMN customer_id TO company_id', target);
  END LOOP;
END $$;
--> statement-breakpoint
-- PostgreSQL keeps constraint/index names on rename; align those too. Foreign keys,
-- grants and RLS remain attached to the same table/column identities.
DO $$
DECLARE item record; renamed text;
BEGIN
  FOR item IN SELECT c.conname, t.relname FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND (c.conname LIKE '%customer%' OR c.conname LIKE '%ticket%')
  LOOP
    renamed := replace(replace(replace(item.conname, 'customers', 'companies'), 'customer', 'company'), 'tickets', 'cases');
    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', item.relname, item.conname, renamed);
  END LOOP;
  FOR item IN SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    AND (indexname LIKE '%customer%' OR indexname LIKE '%ticket%')
  LOOP
    renamed := replace(replace(replace(item.indexname, 'customers', 'companies'), 'customer', 'company'), 'tickets', 'cases');
    EXECUTE format('ALTER INDEX %I RENAME TO %I', item.indexname, renamed);
  END LOOP;
END $$;
