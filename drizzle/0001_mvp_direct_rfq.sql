--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."purchase_request_status" ADD VALUE IF NOT EXISTS 'published';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."purchase_request_status" ADD VALUE IF NOT EXISTS 'awarded';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."purchase_request_status" ADD VALUE IF NOT EXISTS 'closed';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."offer_status" AS ENUM('draft', 'submitted', 'locked', 'selected', 'not_selected', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."fulfillment_status" AS ENUM('new', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'delivered');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."receipt_status" AS ENUM('pending', 'received_full', 'received_with_issue');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."delivery_status" ADD VALUE IF NOT EXISTS 'new';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."delivery_status" ADD VALUE IF NOT EXISTS 'confirmed';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."delivery_status" ADD VALUE IF NOT EXISTS 'ready_for_delivery';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "supplier_profiles" ADD COLUMN IF NOT EXISTS "service_cities" text;
--> statement-breakpoint
ALTER TABLE "supplier_profiles" ADD COLUMN IF NOT EXISTS "about" text;
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "category_id" uuid;
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "delivery_city" text DEFAULT 'الرياض';
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "delivery_district" text;
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "delivery_address_text" text;
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "submission_deadline" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "awarded_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "selected_offer_id" uuid;
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "raw_requirement_text" text;
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "attachment_url" text;
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "attachment_name" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "purchase_request_items" ALTER COLUMN "product_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "product_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "accepted_alternatives" text;
--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "brand_preference" text;
--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "min_shelf_life_months" integer;
--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "supplier_organization_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "supplier_categories" ADD CONSTRAINT "supplier_categories_supplier_organization_id_organizations_id_fk" FOREIGN KEY ("supplier_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "supplier_categories" ADD CONSTRAINT "supplier_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_categories_org_cat_uidx" ON "supplier_categories" USING btree ("supplier_organization_id","category_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_categories_org_idx" ON "supplier_categories" USING btree ("supplier_organization_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "purchase_request_id" uuid NOT NULL,
  "supplier_organization_id" uuid NOT NULL,
  "submitted_by_user_id" uuid,
  "status" "offer_status" DEFAULT 'draft' NOT NULL,
  "offer_validity_date" date,
  "delivery_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
  "payment_terms" text,
  "notes" text,
  "attachment_url" text,
  "attachment_name" text,
  "proposed_delivery_date" date NOT NULL,
  "meets_delivery_date" boolean DEFAULT true NOT NULL,
  "delivery_days_diff" integer DEFAULT 0 NOT NULL,
  "subtotal_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
  "tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
  "total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
  "is_locked" boolean DEFAULT false NOT NULL,
  "submitted_at" timestamp with time zone,
  "locked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offers" ADD CONSTRAINT "offers_purchase_request_id_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offers" ADD CONSTRAINT "offers_supplier_organization_id_organizations_id_fk" FOREIGN KEY ("supplier_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offers" ADD CONSTRAINT "offers_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "offers_code_uidx" ON "offers" USING btree ("code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "offers_request_supplier_uidx" ON "offers" USING btree ("purchase_request_id","supplier_organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offers_supplier_idx" ON "offers" USING btree ("supplier_organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offers_status_idx" ON "offers" USING btree ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offer_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "offer_id" uuid NOT NULL,
  "purchase_request_item_id" uuid,
  "offered_product_name" text NOT NULL,
  "brand_name" text,
  "specification_note" text,
  "available_quantity" integer NOT NULL,
  "unit_price" numeric(12, 2) NOT NULL,
  "line_total" numeric(12, 2) NOT NULL,
  "is_alternative" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offer_items" ADD CONSTRAINT "offer_items_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offer_items" ADD CONSTRAINT "offer_items_purchase_request_item_id_purchase_request_items_id_fk" FOREIGN KEY ("purchase_request_item_id") REFERENCES "public"."purchase_request_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offer_items_offer_idx" ON "offer_items" USING btree ("offer_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offer_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "offer_id" uuid NOT NULL,
  "price_score" numeric(5, 2) NOT NULL,
  "delivery_score" numeric(5, 2) NOT NULL,
  "rating_score" numeric(5, 2) NOT NULL,
  "total_score" numeric(5, 2) NOT NULL,
  "is_best_value" boolean DEFAULT false NOT NULL,
  "is_cheapest" boolean DEFAULT false NOT NULL,
  "is_fastest" boolean DEFAULT false NOT NULL,
  "is_highest_rated" boolean DEFAULT false NOT NULL,
  "explanation" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "offer_scores" ADD CONSTRAINT "offer_scores_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "offer_scores_offer_id_unique" ON "offer_scores" USING btree ("offer_id");
--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "final_offer_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "offer_id" uuid;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "purchase_request_id" uuid;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "fulfillment_status" "fulfillment_status" DEFAULT 'new' NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "receipt_status" "receipt_status" DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "delivery_fee" numeric(12, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "payment_terms" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchase_request_id_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_offer_uidx" ON "purchase_orders" USING btree ("offer_id");
--> statement-breakpoint
ALTER TABLE "purchase_order_items" ALTER COLUMN "product_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "product_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "specification_note" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fulfillment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "purchase_order_id" uuid NOT NULL,
  "from_status" "fulfillment_status",
  "to_status" "fulfillment_status" NOT NULL,
  "changed_by_user_id" uuid,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fulfillment_events" ADD CONSTRAINT "fulfillment_events_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fulfillment_events" ADD CONSTRAINT "fulfillment_events_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fulfillment_events_po_idx" ON "fulfillment_events" USING btree ("purchase_order_id");
--> statement-breakpoint
UPDATE "purchase_request_items" pri
SET "product_name" = COALESCE(NULLIF(pri.product_name, ''), p.name, 'منتج')
FROM "products" p
WHERE pri.product_id = p.id AND (pri.product_name IS NULL OR pri.product_name = '');
--> statement-breakpoint
UPDATE "purchase_order_items" poi
SET "product_name" = COALESCE(NULLIF(poi.product_name, ''), p.name, 'منتج')
FROM "products" p
WHERE poi.product_id = p.id AND (poi.product_name IS NULL OR poi.product_name = '');
