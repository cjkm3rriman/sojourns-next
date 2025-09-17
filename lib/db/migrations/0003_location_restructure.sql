-- Remove old location fields and add new structured location fields
ALTER TABLE "items" DROP COLUMN IF EXISTS "location";
ALTER TABLE "items" DROP COLUMN IF EXISTS "origin_location";
ALTER TABLE "items" DROP COLUMN IF EXISTS "destination_location";
ALTER TABLE "items" DROP COLUMN IF EXISTS "timezone";

-- Add new place reference columns
ALTER TABLE "items" ADD COLUMN "origin_place_id" uuid;
ALTER TABLE "items" ADD COLUMN "destination_place_id" uuid;

-- Add specific location detail columns
ALTER TABLE "items" ADD COLUMN "origin_location_specific" text;
ALTER TABLE "items" ADD COLUMN "destination_location_specific" text;

-- Add separate timezone columns for start and end times
ALTER TABLE "items" ADD COLUMN "start_timezone" text;
ALTER TABLE "items" ADD COLUMN "end_timezone" text;

-- Add foreign key constraints
ALTER TABLE "items" ADD CONSTRAINT "items_origin_place_id_places_id_fk" FOREIGN KEY ("origin_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "items" ADD CONSTRAINT "items_destination_place_id_places_id_fk" FOREIGN KEY ("destination_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;