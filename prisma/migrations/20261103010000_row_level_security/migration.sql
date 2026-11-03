BEGIN;

-- The API always enters this role inside the same transaction that sets the
-- authenticated identity. FORCE also protects queries made by table owners.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fin9_runtime') THEN
    CREATE ROLE fin9_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'fin9_runtime'
      AND (rolsuper OR rolbypassrls OR rolcanlogin OR rolcreaterole OR rolcreatedb OR rolreplication)
  ) THEN
    RAISE EXCEPTION 'fin9_runtime must be a NOLOGIN, unprivileged, NOBYPASSRLS role';
  END IF;
END
$$;

GRANT fin9_runtime TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO fin9_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.users, public.accounts, public.categories, public.transactions,
  public.transfers, public.recurrences, public.budgets, public.goals,
  public.goal_contributions, public.credit_cards, public.card_purchases,
  public.card_invoices, public.card_installments, public.card_payments
TO fin9_runtime;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'accounts', 'categories', 'transactions', 'transfers',
    'recurrences', 'budgets', 'goals', 'goal_contributions', 'credit_cards',
    'card_purchases', 'card_invoices', 'card_installments', 'card_payments'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    -- The permissive baseline grants the runtime role the ability to perform
    -- operations, while the mandatory RESTRICTIVE policies below constrain it.
    -- Another permissive policy cannot accidentally widen the tenant boundary.
    EXECUTE format('CREATE POLICY runtime_access ON public.%I AS PERMISSIVE FOR ALL TO fin9_runtime USING (true) WITH CHECK (true)', table_name);
  END LOOP;
END
$$;

-- Authentication may read only the exact email/verified Google subject being
-- checked. These settings never authorize access to any financial records.
-- The repository sets them internally, never from a generic request body.
CREATE POLICY users_select ON public.users AS RESTRICTIVE FOR SELECT TO fin9_runtime
USING (
  id = nullif(current_setting('app.user_id', true), '')
  OR lower(email) = lower(nullif(current_setting('app.auth_email', true), ''))
  OR google_subject = nullif(current_setting('app.auth_subject', true), '')
);
CREATE POLICY users_insert ON public.users AS RESTRICTIVE FOR INSERT TO fin9_runtime
WITH CHECK (id = nullif(current_setting('app.user_id', true), ''));
CREATE POLICY users_update ON public.users AS RESTRICTIVE FOR UPDATE TO fin9_runtime
USING (id = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (id = nullif(current_setting('app.user_id', true), ''));
CREATE POLICY users_delete ON public.users AS RESTRICTIVE FOR DELETE TO fin9_runtime
USING (id = nullif(current_setting('app.user_id', true), ''));

-- Read/delete ownership is independent of referenced rows, so account deletion
-- and other ordered cleanups keep working. Writes must additionally reference
-- rows owned by the same authenticated user; PostgreSQL FKs alone do not enforce
-- this tenant boundary.
CREATE POLICY accounts_owner ON public.accounts AS RESTRICTIVE FOR ALL TO fin9_runtime
USING (user_id = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (user_id = nullif(current_setting('app.user_id', true), ''));
CREATE POLICY categories_owner ON public.categories AS RESTRICTIVE FOR ALL TO fin9_runtime
USING (user_id = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (user_id = nullif(current_setting('app.user_id', true), ''));
CREATE POLICY goals_owner ON public.goals AS RESTRICTIVE FOR ALL TO fin9_runtime
USING (user_id = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (user_id = nullif(current_setting('app.user_id', true), ''));
CREATE POLICY credit_cards_owner ON public.credit_cards AS RESTRICTIVE FOR ALL TO fin9_runtime
USING (user_id = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (user_id = nullif(current_setting('app.user_id', true), ''));

CREATE POLICY transactions_owner ON public.transactions AS RESTRICTIVE FOR ALL TO fin9_runtime
USING (user_id = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (
  user_id = nullif(current_setting('app.user_id', true), '')
  AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.user_id = transactions.user_id)
  AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.user_id = transactions.user_id)
  AND (recurrence_id IS NULL OR EXISTS (SELECT 1 FROM public.recurrences r WHERE r.id = recurrence_id AND r.user_id = transactions.user_id))
  AND (card_payment_id IS NULL OR EXISTS (SELECT 1 FROM public.card_payments p WHERE p.id = card_payment_id AND p.user_id = transactions.user_id))
);
CREATE POLICY transfers_owner ON public.transfers AS RESTRICTIVE FOR ALL TO fin9_runtime
USING (user_id = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (
  user_id = nullif(current_setting('app.user_id', true), '')
  AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = from_account_id AND a.user_id = transfers.user_id)
  AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = to_account_id AND a.user_id = transfers.user_id)
);
CREATE POLICY recurrences_owner ON public.recurrences AS RESTRICTIVE FOR ALL TO fin9_runtime
USING (user_id = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (
  user_id = nullif(current_setting('app.user_id', true), '')
  AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.user_id = recurrences.user_id)
  AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.user_id = recurrences.user_id)
);
CREATE POLICY budgets_owner ON public.budgets AS RESTRICTIVE FOR ALL TO fin9_runtime
USING (user_id = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (
  user_id = nullif(current_setting('app.user_id', true), '')
  AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.user_id = budgets.user_id)
);
CREATE POLICY goal_contributions_owner ON public.goal_contributions AS RESTRICTIVE FOR ALL TO fin9_runtime
USING (user_id = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (
  user_id = nullif(current_setting('app.user_id', true), '')
  AND EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = goal_contributions.user_id)
  AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.user_id = goal_contributions.user_id)
);
CREATE POLICY card_purchases_owner ON public.card_purchases AS RESTRICTIVE FOR ALL TO fin9_runtime
USING (user_id = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (
  user_id = nullif(current_setting('app.user_id', true), '')
  AND EXISTS (SELECT 1 FROM public.credit_cards c WHERE c.id = card_id AND c.user_id = card_purchases.user_id)
  AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.user_id = card_purchases.user_id)
);
CREATE POLICY card_invoices_owner ON public.card_invoices AS RESTRICTIVE FOR ALL TO fin9_runtime
USING (user_id = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (
  user_id = nullif(current_setting('app.user_id', true), '')
  AND EXISTS (SELECT 1 FROM public.credit_cards c WHERE c.id = card_id AND c.user_id = card_invoices.user_id)
);
CREATE POLICY card_payments_owner ON public.card_payments AS RESTRICTIVE FOR ALL TO fin9_runtime
USING (user_id = nullif(current_setting('app.user_id', true), ''))
WITH CHECK (
  user_id = nullif(current_setting('app.user_id', true), '')
  AND EXISTS (SELECT 1 FROM public.card_invoices i WHERE i.id = invoice_id AND i.user_id = card_payments.user_id)
  AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.user_id = card_payments.user_id)
);

-- Installments have no user_id: both parents must belong to the current user.
CREATE POLICY card_installments_owner ON public.card_installments AS RESTRICTIVE FOR ALL TO fin9_runtime
USING (
  EXISTS (SELECT 1 FROM public.card_purchases p WHERE p.id = purchase_id AND p.user_id = nullif(current_setting('app.user_id', true), ''))
  AND EXISTS (SELECT 1 FROM public.card_invoices i WHERE i.id = invoice_id AND i.user_id = nullif(current_setting('app.user_id', true), ''))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.card_purchases p WHERE p.id = purchase_id AND p.user_id = nullif(current_setting('app.user_id', true), ''))
  AND EXISTS (SELECT 1 FROM public.card_invoices i WHERE i.id = invoice_id AND i.user_id = nullif(current_setting('app.user_id', true), ''))
);

COMMIT;
