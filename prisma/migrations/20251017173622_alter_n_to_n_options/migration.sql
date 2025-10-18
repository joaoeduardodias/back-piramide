/*
  Warnings:

  - You are about to drop the column `product_id` on the `options` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."options" DROP CONSTRAINT "options_product_id_fkey";

-- DropIndex
DROP INDEX "public"."options_product_id_name_key";

-- AlterTable
ALTER TABLE "public"."options" DROP COLUMN "product_id";

-- CreateTable
CREATE TABLE "public"."product_option" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,

    CONSTRAINT "product_option_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_option_product_id_option_id_key" ON "public"."product_option"("product_id", "option_id");

-- AddForeignKey
ALTER TABLE "public"."product_option" ADD CONSTRAINT "product_option_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_option" ADD CONSTRAINT "product_option_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
