/*
  Warnings:

  - You are about to alter the column `price` on the `product` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `compare_price` on the `product` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `price` on the `product_variant` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `compare_price` on the `product_variant` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.

*/
-- AlterTable
ALTER TABLE "order_item" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "product" ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "compare_price" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "product_variant" ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "compare_price" SET DATA TYPE DOUBLE PRECISION;
