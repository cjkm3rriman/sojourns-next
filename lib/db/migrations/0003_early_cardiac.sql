-- Custom SQL migration file, put your code below! --

-- Add vector_store_id column to trips table
ALTER TABLE "trips" ADD COLUMN "vector_store_id" text;