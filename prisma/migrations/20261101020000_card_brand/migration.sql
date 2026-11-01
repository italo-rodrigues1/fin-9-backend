CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD', 'ELO', 'AMERICAN_EXPRESS', 'HIPERCARD');

-- Existing cards keep an unknown brand until explicitly selected by the user.
ALTER TABLE "credit_cards" ADD COLUMN "brand" "CardBrand";
