ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "category_other_text" text;--> statement-breakpoint
ALTER TABLE "purchase_requests" ALTER COLUMN "delivery_city" DROP DEFAULT;
