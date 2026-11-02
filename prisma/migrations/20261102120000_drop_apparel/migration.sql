-- S-3D prints 3D models, not shirts: the size tables, shirt design templates and the photo
-- print area of products came from the apparel shop the code started from.

-- DropForeignKey
ALTER TABLE "product_size_rows" DROP CONSTRAINT "product_size_rows_product_id_fkey";

-- DropForeignKey
ALTER TABLE "product_size_rows" DROP CONSTRAINT "product_size_rows_size_id_fkey";

-- DropForeignKey
ALTER TABLE "templates" DROP CONSTRAINT "templates_category_id_fkey";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "design_area";

-- DropTable
DROP TABLE "product_size_rows";

-- DropTable
DROP TABLE "sizes";

-- DropTable
DROP TABLE "template_categories";

-- DropTable
DROP TABLE "templates";

