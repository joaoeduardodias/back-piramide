/*
  Warnings:

  - You are about to alter the column `unitPrice` on the `order_item` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.

*/
-- AlterTable
ALTER TABLE "order_item" ALTER COLUMN "unitPrice" SET DATA TYPE DOUBLE PRECISION;
