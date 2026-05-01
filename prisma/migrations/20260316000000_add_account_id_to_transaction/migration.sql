-- Step 1: Add account_id as nullable
ALTER TABLE "transactions" ADD COLUMN "account_id" TEXT;

-- Step 2: Fill account_id with the first account of each user (or create a default account if none exists)
DO $$
DECLARE
  r RECORD;
  default_account_id TEXT;
BEGIN
  -- For each user that has transactions without account_id
  FOR r IN
    SELECT DISTINCT t.user_id
    FROM transactions t
    WHERE t.account_id IS NULL
  LOOP
    -- Try to find the first account for this user
    SELECT id INTO default_account_id
    FROM accounts
    WHERE user_id = r.user_id
    ORDER BY created_at ASC
    LIMIT 1;

    -- If no account exists, create a default one
    IF default_account_id IS NULL THEN
      default_account_id := gen_random_uuid()::TEXT;
      INSERT INTO accounts (id, name, institution, balance, color, icon, user_id, created_at, updated_at)
      VALUES (
        default_account_id,
        'Padrão',
        'Padrão',
        0,
        '#7C3AED',
        'bank-outline',
        r.user_id,
        NOW(),
        NOW()
      );
    END IF;

    -- Update all transactions for this user that have no account_id
    UPDATE transactions
    SET account_id = default_account_id
    WHERE user_id = r.user_id AND account_id IS NULL;
  END LOOP;
END $$;

-- Step 3: Make account_id NOT NULL
ALTER TABLE "transactions" ALTER COLUMN "account_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "transactions_user_id_account_id_idx" ON "transactions"("user_id", "account_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
