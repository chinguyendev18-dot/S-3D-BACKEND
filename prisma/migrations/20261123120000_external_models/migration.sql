-- CreateEnum
CREATE TYPE "ExternalModelSource" AS ENUM ('makerworld', 'printables', 'thingiverse');

-- CreateEnum
CREATE TYPE "LicenseVerdict" AS ENUM ('allowed', 'limited', 'blocked');

-- CreateEnum
CREATE TYPE "LicenseCheckBasis" AS ENUM ('license', 'membership', 'permission');

-- CreateTable
CREATE TABLE "external_models" (
    "id" TEXT NOT NULL,
    "source" "ExternalModelSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "creator_name" TEXT NOT NULL DEFAULT '',
    "creator_url" TEXT NOT NULL DEFAULT '',
    "license_code" TEXT NOT NULL,
    "verdict" "LicenseVerdict" NOT NULL,
    "basis" "LicenseCheckBasis" NOT NULL,
    "membership_until" DATE,
    "checked_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_model_checks" (
    "id" UUID NOT NULL,
    "model_id" TEXT NOT NULL,
    "license_code" TEXT NOT NULL,
    "verdict" "LicenseVerdict" NOT NULL,
    "basis" "LicenseCheckBasis" NOT NULL,
    "membership_until" DATE,
    "evidence_key" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "acknowledgements" TEXT[],
    "checked_by_id" UUID,
    "checked_by_name" TEXT NOT NULL DEFAULT '',
    "checked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_model_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_models_verdict_idx" ON "external_models"("verdict");

-- CreateIndex
CREATE INDEX "external_models_checked_at_idx" ON "external_models"("checked_at");

-- CreateIndex
CREATE UNIQUE INDEX "external_models_source_external_id_key" ON "external_models"("source", "external_id");

-- CreateIndex
CREATE INDEX "external_model_checks_model_id_checked_at_idx" ON "external_model_checks"("model_id", "checked_at");

-- AddForeignKey
ALTER TABLE "external_model_checks" ADD CONSTRAINT "external_model_checks_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "external_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Only the backend reads these tables (see 20261101120000_catalog_content): the Supabase API roles get nothing.
ALTER TABLE "external_models" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "external_model_checks" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "external_models", "external_model_checks" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "external_models", "external_model_checks" FROM authenticated;
  END IF;
END $$;
