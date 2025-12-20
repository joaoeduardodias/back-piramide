/*
  Warnings:

  - You are about to alter the column `value` on the `Coupon` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `minOrderValue` on the `Coupon` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.

*/
-- AlterTable
ALTER TABLE "Coupon" ALTER COLUMN "value" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "minOrderValue" SET DATA TYPE DOUBLE PRECISION;
