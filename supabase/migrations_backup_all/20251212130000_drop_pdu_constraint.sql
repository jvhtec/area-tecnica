-- Drop the restrictive check constraint on pdu_type
ALTER TABLE "public"."power_requirement_tables" DROP CONSTRAINT IF EXISTS "valid_pdu_type";
