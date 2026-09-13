CREATE TYPE "document_category" AS ENUM (
  'operation', 'service', 'installation', 'safety', 'schematic', 'drawing',
  'parts', 'certificate', 'datasheet', 'bulletin', 'parameters', 'backup', 'cad', 'other'
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "category" "document_category" NOT NULL DEFAULT 'other';
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "indexable" boolean NOT NULL DEFAULT true;
