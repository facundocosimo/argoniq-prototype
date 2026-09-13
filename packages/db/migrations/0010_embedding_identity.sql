-- Keep existing vectors, but never treat untagged vectors as compatible with a new model.
ALTER TABLE "document_chunks" ADD COLUMN "embedding_model" varchar(200);
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "embedding_input_hash" varchar(64);
