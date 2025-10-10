-- AlterTable
ALTER TABLE "public"."product" ADD COLUMN     "compare_price" DECIMAL(12,2),
ADD COLUMN     "emphases" BOOLEAN,
ADD COLUMN     "tags" TEXT;

-- AlterTable
ALTER TABLE "public"."product_variant" ADD COLUMN     "compare_price" DECIMAL(12,2);
