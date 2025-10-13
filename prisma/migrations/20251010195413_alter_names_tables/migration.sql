/*
  Warnings:

  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Option` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OptionValue` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VariantOptionValue` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Option" DROP CONSTRAINT "Option_product_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."OptionValue" DROP CONSTRAINT "OptionValue_option_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductCategory" DROP CONSTRAINT "ProductCategory_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductCategory" DROP CONSTRAINT "ProductCategory_product_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."VariantOptionValue" DROP CONSTRAINT "VariantOptionValue_option_value_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."VariantOptionValue" DROP CONSTRAINT "VariantOptionValue_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."product_image" DROP CONSTRAINT "product_image_option_value_id_fkey";

-- DropTable
DROP TABLE "public"."Category";

-- DropTable
DROP TABLE "public"."Option";

-- DropTable
DROP TABLE "public"."OptionValue";

-- DropTable
DROP TABLE "public"."ProductCategory";

-- DropTable
DROP TABLE "public"."VariantOptionValue";

-- CreateTable
CREATE TABLE "public"."category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_category" (
    "product_id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "product_category_pkey" PRIMARY KEY ("product_id","categoryId")
);

-- CreateTable
CREATE TABLE "public"."options" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."option_value" (
    "id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "option_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."variant_option_value" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "option_value_id" TEXT NOT NULL,

    CONSTRAINT "variant_option_value_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "public"."category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "options_product_id_name_key" ON "public"."options"("product_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "option_value_option_id_value_key" ON "public"."option_value"("option_id", "value");

-- CreateIndex
CREATE UNIQUE INDEX "variant_option_value_variant_id_option_value_id_key" ON "public"."variant_option_value"("variant_id", "option_value_id");

-- AddForeignKey
ALTER TABLE "public"."product_image" ADD CONSTRAINT "product_image_option_value_id_fkey" FOREIGN KEY ("option_value_id") REFERENCES "public"."option_value"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_category" ADD CONSTRAINT "product_category_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_category" ADD CONSTRAINT "product_category_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."options" ADD CONSTRAINT "options_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."option_value" ADD CONSTRAINT "option_value_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."variant_option_value" ADD CONSTRAINT "variant_option_value_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."variant_option_value" ADD CONSTRAINT "variant_option_value_option_value_id_fkey" FOREIGN KEY ("option_value_id") REFERENCES "public"."option_value"("id") ON DELETE CASCADE ON UPDATE CASCADE;
