-- Models added before the images column have NULL there: an empty list instead, and by default.
UPDATE "external_models" SET "images" = ARRAY[]::TEXT[] WHERE "images" IS NULL;

-- AlterTable
ALTER TABLE "external_models" ALTER COLUMN "images" SET DEFAULT ARRAY[]::TEXT[];
