-- CreateTable
CREATE TABLE "public"."product_option_value" (
    "id" TEXT NOT NULL,
    "product_option_id" TEXT NOT NULL,
    "option_value_id" TEXT NOT NULL,

    CONSTRAINT "product_option_value_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_option_value_product_option_id_option_value_id_key" ON "public"."product_option_value"("product_option_id", "option_value_id");

-- AddForeignKey
ALTER TABLE "public"."product_option_value" ADD CONSTRAINT "product_option_value_product_option_id_fkey" FOREIGN KEY ("product_option_id") REFERENCES "public"."product_option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_option_value" ADD CONSTRAINT "product_option_value_option_value_id_fkey" FOREIGN KEY ("option_value_id") REFERENCES "public"."option_value"("id") ON DELETE CASCADE ON UPDATE CASCADE;
