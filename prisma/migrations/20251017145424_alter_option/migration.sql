/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `options` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."option_value" ADD COLUMN     "content" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "options_name_key" ON "public"."options"("name");
