ALTER TYPE "public"."serial_status" ADD VALUE IF NOT EXISTS 'not_installed';--> statement-breakpoint
ALTER TYPE "public"."serial_status" ADD VALUE IF NOT EXISTS 'maintenance';
