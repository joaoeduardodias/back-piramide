/*
  Warnings:

  - Made the column `sku` on table `product_variant` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."product_variant" ALTER COLUMN "sku" SET NOT NULL;
