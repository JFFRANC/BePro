CREATE TABLE "client_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"account_executive_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_assignments_tenant_client_user_uq" UNIQUE("tenant_id","client_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_contacts_tenant_client_email_uq" UNIQUE("tenant_id","client_id","email")
);
--> statement-breakpoint
CREATE TABLE "client_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"document_type" varchar(30) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_positions_tenant_client_name_uq" UNIQUE("tenant_id","client_id","name")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"contact_info" varchar(500),
	"address" varchar(500),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"form_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_account_executive_id_users_id_fk" FOREIGN KEY ("account_executive_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_positions" ADD CONSTRAINT "client_positions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_positions" ADD CONSTRAINT "client_positions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_assignments_tenant_id_idx" ON "client_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "client_assignments_client_id_idx" ON "client_assignments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_assignments_user_id_idx" ON "client_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "client_contacts_tenant_id_idx" ON "client_contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "client_contacts_client_id_idx" ON "client_contacts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_documents_tenant_id_idx" ON "client_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "client_documents_client_id_idx" ON "client_documents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_positions_tenant_id_idx" ON "client_positions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "client_positions_client_id_idx" ON "client_positions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "clients_tenant_id_idx" ON "clients" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "clients_tenant_name_idx" ON "clients" USING btree ("tenant_id","name");