-- AlterTable
ALTER TABLE "product" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "cpf" TEXT;
