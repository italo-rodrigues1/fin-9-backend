BEGIN;
-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "card_payment_id" TEXT;

-- CreateTable
CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credit_limit" DECIMAL(12,2) NOT NULL,
    "closing_day" INTEGER NOT NULL,
    "due_day" INTEGER NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_purchases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_invoices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "closing_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_installments" (
    "id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "card_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "request_id" TEXT NOT NULL,
    "reversed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_cards_user_id_created_at_idx" ON "credit_cards"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "card_purchases_card_id_date_id_idx" ON "card_purchases"("card_id", "date", "id");

-- CreateIndex
CREATE UNIQUE INDEX "card_purchases_user_id_request_id_key" ON "card_purchases"("user_id", "request_id");

-- CreateIndex
CREATE INDEX "card_invoices_user_id_due_date_idx" ON "card_invoices"("user_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "card_invoices_card_id_year_month_key" ON "card_invoices"("card_id", "year", "month");

-- CreateIndex
CREATE INDEX "card_installments_invoice_id_idx" ON "card_installments"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_installments_purchase_id_number_key" ON "card_installments"("purchase_id", "number");

-- CreateIndex
CREATE INDEX "card_payments_invoice_id_reversed_at_idx" ON "card_payments"("invoice_id", "reversed_at");

-- CreateIndex
CREATE UNIQUE INDEX "card_payments_user_id_request_id_key" ON "card_payments"("user_id", "request_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_card_payment_id_fkey" FOREIGN KEY ("card_payment_id") REFERENCES "card_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchases" ADD CONSTRAINT "card_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchases" ADD CONSTRAINT "card_purchases_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchases" ADD CONSTRAINT "card_purchases_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_invoices" ADD CONSTRAINT "card_invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_invoices" ADD CONSTRAINT "card_invoices_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_installments" ADD CONSTRAINT "card_installments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "card_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_installments" ADD CONSTRAINT "card_installments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "card_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payments" ADD CONSTRAINT "card_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payments" ADD CONSTRAINT "card_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "card_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payments" ADD CONSTRAINT "card_payments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_valid_values" CHECK ("credit_limit" > 0 AND "closing_day" BETWEEN 1 AND 31 AND "due_day" BETWEEN 1 AND 31);
ALTER TABLE "card_purchases" ADD CONSTRAINT "card_purchases_valid_values" CHECK ("amount" > 0 AND "installment_count" BETWEEN 1 AND 36);
ALTER TABLE "card_invoices" ADD CONSTRAINT "card_invoices_valid_cycle" CHECK ("month" BETWEEN 1 AND 12 AND "year" BETWEEN 1900 AND 9999 AND "due_date" >= "closing_date");
ALTER TABLE "card_installments" ADD CONSTRAINT "card_installments_valid_values" CHECK ("amount" > 0 AND "number" BETWEEN 1 AND 36);
ALTER TABLE "card_payments" ADD CONSTRAINT "card_payments_positive_amount" CHECK ("amount" > 0);
CREATE UNIQUE INDEX "card_payments_one_active_invoice" ON "card_payments"("invoice_id") WHERE "reversed_at" IS NULL;
CREATE INDEX "transactions_card_payment_id_idx" ON "transactions"("card_payment_id");
COMMIT;
