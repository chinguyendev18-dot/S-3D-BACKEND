-- CreateTable
CREATE TABLE "external_model_files" (
    "id" UUID NOT NULL,
    "model_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "profile_name" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "uploaded_by_id" UUID,
    "uploaded_by_name" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_model_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_model_files_key_key" ON "external_model_files"("key");

-- CreateIndex
CREATE INDEX "external_model_files_model_id_created_at_idx" ON "external_model_files"("model_id", "created_at");

-- AddForeignKey
ALTER TABLE "external_model_files" ADD CONSTRAINT "external_model_files_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "external_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Only the backend reads this table (see 20261101120000_catalog_content): the Supabase API roles get nothing.
ALTER TABLE "external_model_files" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "external_model_files" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "external_model_files" FROM authenticated;
  END IF;
END $$;
