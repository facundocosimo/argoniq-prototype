ALTER TABLE cases ADD COLUMN submission_key uuid, ADD COLUMN submitted_by uuid, ADD COLUMN submission_hash text, ADD COLUMN report jsonb, ADD COLUMN destination jsonb;
CREATE UNIQUE INDEX cases_submission_key_unique ON cases (tenant_id, submission_key);
CREATE TABLE case_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 case_id uuid REFERENCES cases(id) ON DELETE CASCADE, serial_id uuid NOT NULL REFERENCES serials(id) ON DELETE CASCADE,
 uploaded_by uuid NOT NULL, submission_key uuid NOT NULL, filename text NOT NULL, content_type text NOT NULL,
 size integer NOT NULL CHECK(size > 0 AND size <= 10485760), storage_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX case_attachments_case_idx ON case_attachments(case_id);
CREATE INDEX case_attachments_draft_idx ON case_attachments(tenant_id,submission_key);
CREATE TABLE case_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','uncertain')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), claim_token uuid,
 machine_context jsonb NOT NULL, external_id text, error text, sent_at timestamptz, attachment_external_ids jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX case_deliveries_case_unique ON case_deliveries(case_id);
CREATE INDEX case_deliveries_pending_idx ON case_deliveries(tenant_id,status,next_attempt_at);
