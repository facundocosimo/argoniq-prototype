CREATE TYPE "membership_state" AS ENUM ('active', 'suspended');
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "state" "membership_state" NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "suspended_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE "auth_users" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" varchar(200) NOT NULL,
 "email" varchar(320) NOT NULL, "email_verified" boolean NOT NULL DEFAULT false,
 "image" text, "is_platform_operator" boolean NOT NULL DEFAULT false,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_email_uq" ON "auth_users" ("email");
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "expires_at" timestamp with time zone NOT NULL,
 "token" varchar(255) NOT NULL, "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now(), "ip_address" varchar(64), "user_agent" text,
 "user_id" uuid NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_uq" ON "auth_sessions" ("token");
--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" ("user_id");
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "account_id" varchar(255) NOT NULL,
 "issuer" text NOT NULL, "provider_id" varchar(100) NOT NULL, "user_id" uuid NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE,
 "access_token" text, "refresh_token" text, "id_token" text,
 "access_token_expires_at" timestamp with time zone, "refresh_token_expires_at" timestamp with time zone,
 "scope" text, "password" text,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_issuer_account_uq" ON "auth_accounts" ("issuer", "account_id");
--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" ("user_id");
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "identifier" varchar(320) NOT NULL,
 "value" text NOT NULL, "expires_at" timestamp with time zone NOT NULL,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" ("identifier");
