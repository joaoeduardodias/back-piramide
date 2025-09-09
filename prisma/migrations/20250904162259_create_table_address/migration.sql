-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "public"."Address" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "complement" TEXT,
    "number" TEXT,
    "district" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BR',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Address" ADD CONSTRAINT "Address_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
