/*
  Warnings:

  - A unique constraint covering the columns `[file_key]` on the table `product_image` will be added. If there are existing duplicate values, this will fail.
  - Made the column `file_key` on table `product_image` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "product_image" ALTER COLUMN "file_key" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "product_image_file_key_key" ON "product_image"("file_key");
