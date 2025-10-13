/*
  Warnings:

  - You are about to drop the column `emphases` on the `product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."product" DROP COLUMN "emphases",
ADD COLUMN     "featured" BOOLEAN;
