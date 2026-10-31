-- Apply transactions created before account balances were updated atomically.
-- This migration runs once; subsequent changes are handled by the repository.
UPDATE "accounts" AS account
SET "balance" = account."balance" + transaction_totals."delta"
FROM (
  SELECT
    "account_id",
    SUM(
      CASE
        WHEN "type" = 'INCOME' THEN "amount"
        ELSE -"amount"
      END
    ) AS "delta"
  FROM "transactions"
  GROUP BY "account_id"
) AS transaction_totals
WHERE account."id" = transaction_totals."account_id";
