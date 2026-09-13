-- Existing sources require explicit review; ingestion never implies publication.
ALTER TABLE documents
 ADD COLUMN publication varchar(20) NOT NULL DEFAULT 'draft',
 ADD COLUMN revision_group_id uuid NOT NULL DEFAULT gen_random_uuid(),
 ADD COLUMN published_at timestamptz,
 ADD COLUMN deleted_at timestamptz,
 ADD COLUMN ingestion_token uuid,
 ADD COLUMN processing_error text,
 ADD COLUMN extraction_report jsonb,
 ADD COLUMN upload_key uuid,
 ADD COLUMN upload_fingerprint varchar(64),
 ADD CONSTRAINT documents_publication_ck CHECK (publication IN ('draft','in_review','approved','withdrawn'));
CREATE UNIQUE INDEX documents_upload_key_uq ON documents(tenant_id, upload_key);
CREATE UNIQUE INDEX documents_group_revision_uq ON documents(tenant_id, revision_group_id, revision_number);
CREATE INDEX documents_effective_idx ON documents(tenant_id, revision_group_id, effective_from) WHERE publication = 'approved' AND deleted_at IS NULL;
UPDATE documents SET is_current = false;
CREATE UNIQUE INDEX documents_group_label_uq ON documents(tenant_id, revision_group_id, revision_label);
-- Published source identity is immutable even for direct SQL callers.
CREATE FUNCTION protect_published_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.published_at IS NOT NULL AND (
   NEW.published_at IS DISTINCT FROM OLD.published_at OR NEW.deleted_at IS NOT NULL OR
   (NEW.title, NEW.doc_key, NEW.revision_label, NEW.revision_number, NEW.revision_group_id, NEW.language,
    NEW.tier, NEW.family_id, NEW.model_id, NEW.company_id, NEW.serial_id, NEW.installation_id,
    NEW.storage_key, NEW.file_hash, NEW.indexable, NEW.category) IS DISTINCT FROM
   (OLD.title, OLD.doc_key, OLD.revision_label, OLD.revision_number, OLD.revision_group_id, OLD.language,
    OLD.tier, OLD.family_id, OLD.model_id, OLD.company_id, OLD.serial_id, OLD.installation_id,
    OLD.storage_key, OLD.file_hash, OLD.indexable, OLD.category)
 ) THEN RAISE EXCEPTION 'Published document identity is immutable' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER documents_immutable_published BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION protect_published_document();
