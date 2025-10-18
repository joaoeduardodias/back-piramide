/*
  Warnings:

  - Added the required column `sales` to the `product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."product" ADD COLUMN     "sales" DOUBLE PRECISION NOT NULL;
