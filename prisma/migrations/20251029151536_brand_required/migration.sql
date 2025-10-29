/*
  Warnings:

  - Made the column `brand_id` on table `product` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."product" DROP CONSTRAINT "product_brand_id_fkey";

-- AlterTable
ALTER TABLE "public"."product" ALTER COLUMN "brand_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."product" ADD CONSTRAINT "product_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
