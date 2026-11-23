-- AlterTable
ALTER TABLE "external_models" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "profiles" JSONB NOT NULL DEFAULT '[]';

