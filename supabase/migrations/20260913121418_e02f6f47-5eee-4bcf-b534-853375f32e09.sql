
-- ENUMS
CREATE TYPE public.savings_product_type AS ENUM ('ORDINARY','SPECIAL','INVESTMENT','OTHER');
CREATE TYPE public.savings_account_status AS ENUM ('PENDING','ACTIVE','FROZEN','DORMANT','CLOSED');
CREATE TYPE public.contribution_frequency AS ENUM ('MONTHLY','WEEKLY','BIWEEKLY','QUARTERLY','ANNUAL','CUSTOM');
CREATE TYPE public.savings_direction AS ENUM ('CREDIT','DEBIT');
CREATE TYPE public.savings_transaction_source AS ENUM ('MANUAL','BANK_TRANSFER','CASH','CHECK_OFF','IMPORT','OPENING_BALANCE','SYSTEM');
CREATE TYPE public.savings_transaction_status AS ENUM ('DRAFT','SUBMITTED','CHECKED','APPROVED','POSTED','REJECTED','REVERSED','CANCELLED');
CREATE TYPE public.savings_transaction_type AS ENUM (
  'OPENING_BALANCE','CONTRIBUTION','SPECIAL_CONTRIBUTION','CHECK_OFF_CONTRIBUTION','BANK_TRANSFER_CONTRIBUTION',
  'CASH_CONTRIBUTION','ADJUSTMENT_CREDIT','ADJUSTMENT_DEBIT','INTEREST_CREDIT','BONUS_CREDIT','WITHDRAWAL',
  'REVERSAL','TRANSFER_IN','TRANSFER_OUT','OTHER_CREDIT','OTHER_DEBIT');
CREATE TYPE public.contribution_period_status AS ENUM ('OPEN','PROCESSING','POSTED','CLOSED');
CREATE TYPE public.contribution_compliance_status AS ENUM ('NOT_DUE','DUE','PARTIALLY_PAID','FULLY_PAID','OVERPAID','WAIVED','SUSPENDED','NOT_APPLICABLE');
CREATE TYPE public.savings_batch_status AS ENUM ('DRAFT','VALIDATED','APPROVED','POSTED','CANCELLED');

-- SAVINGS PRODUCTS
CREATE TABLE public.savings_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  product_code text NOT NULL,
  product_name text NOT NULL,
  description text,
  product_type public.savings_product_type NOT NULL DEFAULT 'ORDINARY',
  status text NOT NULL DEFAULT 'ACTIVE',
  currency text NOT NULL DEFAULT 'NGN',
  minimum_opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  minimum_contribution numeric(18,2),
  maximum_contribution numeric(18,2),
  contribution_frequency public.contribution_frequency NOT NULL DEFAULT 'MONTHLY',
  withdrawal_allowed boolean NOT NULL DEFAULT true,
  withdrawal_frequency_limit integer,
  withdrawal_percentage_limit numeric(5,2),
  withdrawal_notice_days integer,
  eligibility_wait_days integer NOT NULL DEFAULT 0,
  interest_enabled boolean NOT NULL DEFAULT false,
  interest_method text,
  interest_rate numeric(7,4),
  bonus_eligible boolean NOT NULL DEFAULT false,
  loan_eligibility_enabled boolean NOT NULL DEFAULT true,
  collateral_eligible boolean NOT NULL DEFAULT false,
  account_number_format text NOT NULL DEFAULT '{MEMBER}-{PRODUCT}',
  is_sample boolean NOT NULL DEFAULT false,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (cooperative_id, product_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_products TO authenticated;
GRANT ALL ON public.savings_products TO service_role;
ALTER TABLE public.savings_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "savings_products_read" ON public.savings_products FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "savings_products_write" ON public.savings_products FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'savings.manage_products', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'savings.manage_products', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));

-- MEMBER SAVINGS ACCOUNTS
CREATE TABLE public.member_savings_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  savings_product_id uuid NOT NULL REFERENCES public.savings_products(id),
  account_number text NOT NULL,
  status public.savings_account_status NOT NULL DEFAULT 'ACTIVE',
  opened_date date NOT NULL DEFAULT CURRENT_DATE,
  closed_date date,
  opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  current_balance numeric(18,2) NOT NULL DEFAULT 0,
  locked_balance numeric(18,2) NOT NULL DEFAULT 0,
  available_balance numeric(18,2) NOT NULL DEFAULT 0,
  accrued_interest numeric(18,2) NOT NULL DEFAULT 0,
  accrued_bonus numeric(18,2) NOT NULL DEFAULT 0,
  last_transaction_date date,
  last_statement_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (cooperative_id, account_number)
);
CREATE INDEX idx_msa_member ON public.member_savings_accounts(member_id);
CREATE INDEX idx_msa_coop ON public.member_savings_accounts(cooperative_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_savings_accounts TO authenticated;
GRANT ALL ON public.member_savings_accounts TO service_role;
ALTER TABLE public.member_savings_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msa_read" ON public.member_savings_accounts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid())
    OR public.has_permission(cooperative_id, 'savings.view', auth.uid())
    OR public.can_admin_cooperative(cooperative_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );
CREATE POLICY "msa_write" ON public.member_savings_accounts FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'savings.create', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'savings.create', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));

-- CONTRIBUTION PERIODS
CREATE TABLE public.contribution_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  due_date date,
  status public.contribution_period_status NOT NULL DEFAULT 'OPEN',
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (cooperative_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contribution_periods TO authenticated;
GRANT ALL ON public.contribution_periods TO service_role;
ALTER TABLE public.contribution_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cperiods_read" ON public.contribution_periods FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "cperiods_write" ON public.contribution_periods FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'savings.manage_schedules', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'savings.manage_schedules', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));

-- CATEGORY DEFAULT CONTRIBUTIONS
CREATE TABLE public.category_contribution_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.membership_categories(id) ON DELETE CASCADE,
  savings_product_id uuid NOT NULL REFERENCES public.savings_products(id) ON DELETE CASCADE,
  expected_amount numeric(18,2) NOT NULL,
  frequency public.contribution_frequency NOT NULL DEFAULT 'MONTHLY',
  due_day integer,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_contribution_defaults TO authenticated;
GRANT ALL ON public.category_contribution_defaults TO service_role;
ALTER TABLE public.category_contribution_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ccd_read" ON public.category_contribution_defaults FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "ccd_write" ON public.category_contribution_defaults FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'savings.manage_schedules', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'savings.manage_schedules', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));

-- MEMBER CONTRIBUTION SCHEDULES
CREATE TABLE public.member_contribution_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  savings_product_id uuid NOT NULL REFERENCES public.savings_products(id),
  expected_amount numeric(18,2) NOT NULL,
  frequency public.contribution_frequency NOT NULL DEFAULT 'MONTHLY',
  due_day integer,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  status text NOT NULL DEFAULT 'ACTIVE',
  reason_for_change text,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
CREATE INDEX idx_mcs_member ON public.member_contribution_schedules(member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_contribution_schedules TO authenticated;
GRANT ALL ON public.member_contribution_schedules TO service_role;
ALTER TABLE public.member_contribution_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mcs_read" ON public.member_contribution_schedules FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid())
    OR public.has_permission(cooperative_id, 'savings.view', auth.uid())
    OR public.can_admin_cooperative(cooperative_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );
CREATE POLICY "mcs_write" ON public.member_contribution_schedules FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'savings.manage_schedules', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'savings.manage_schedules', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));

-- MIGRATION BATCHES
CREATE TABLE public.savings_migration_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  batch_reference text NOT NULL,
  description text,
  source text,
  status public.savings_batch_status NOT NULL DEFAULT 'DRAFT',
  row_count integer NOT NULL DEFAULT 0,
  total_amount numeric(18,2) NOT NULL DEFAULT 0,
  approved_by uuid,
  approved_at timestamptz,
  posted_by uuid,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (cooperative_id, batch_reference)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_migration_batches TO authenticated;
GRANT ALL ON public.savings_migration_batches TO service_role;
ALTER TABLE public.savings_migration_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "smb_read" ON public.savings_migration_batches FOR SELECT TO authenticated
  USING (public.has_permission(cooperative_id, 'savings.view', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "smb_write" ON public.savings_migration_batches FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'savings.import', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'savings.import', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));

-- SAVINGS TRANSACTIONS
CREATE TABLE public.savings_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id),
  savings_account_id uuid NOT NULL REFERENCES public.member_savings_accounts(id),
  savings_product_id uuid NOT NULL REFERENCES public.savings_products(id),
  period_id uuid REFERENCES public.contribution_periods(id),
  batch_id uuid REFERENCES public.savings_migration_batches(id),
  transaction_number text NOT NULL,
  transaction_type public.savings_transaction_type NOT NULL,
  direction public.savings_direction NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  value_date date NOT NULL DEFAULT CURRENT_DATE,
  eligible_from_date date,
  source public.savings_transaction_source NOT NULL DEFAULT 'MANUAL',
  payment_reference text,
  external_reference text,
  description text,
  status public.savings_transaction_status NOT NULL DEFAULT 'DRAFT',
  created_by uuid,
  checked_by uuid,
  approved_by uuid,
  posted_by uuid,
  posted_at timestamptz,
  reversal_of_transaction_id uuid REFERENCES public.savings_transactions(id),
  reversed_at timestamptz,
  reversal_reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (cooperative_id, transaction_number)
);
CREATE INDEX idx_stx_account ON public.savings_transactions(savings_account_id, status);
CREATE INDEX idx_stx_member ON public.savings_transactions(member_id);
CREATE INDEX idx_stx_coop_date ON public.savings_transactions(cooperative_id, transaction_date DESC);
CREATE INDEX idx_stx_dupe ON public.savings_transactions(cooperative_id, external_reference);
GRANT SELECT, INSERT, UPDATE ON public.savings_transactions TO authenticated;
GRANT ALL ON public.savings_transactions TO service_role;
ALTER TABLE public.savings_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stx_read" ON public.savings_transactions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid())
    OR public.has_permission(cooperative_id, 'savings.view', auth.uid())
    OR public.can_admin_cooperative(cooperative_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );
CREATE POLICY "stx_insert" ON public.savings_transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(cooperative_id, 'savings.create', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "stx_update" ON public.savings_transactions FOR UPDATE TO authenticated
  USING (public.has_permission(cooperative_id, 'savings.create', auth.uid()) OR public.has_permission(cooperative_id, 'savings.approve', auth.uid()) OR public.has_permission(cooperative_id, 'savings.post', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'savings.create', auth.uid()) OR public.has_permission(cooperative_id, 'savings.approve', auth.uid()) OR public.has_permission(cooperative_id, 'savings.post', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));

-- CONTRIBUTION ALLOCATIONS (split one receipt across products/periods)
CREATE TABLE public.contribution_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id),
  receipt_reference text,
  receipt_amount numeric(18,2),
  savings_product_id uuid NOT NULL REFERENCES public.savings_products(id),
  savings_transaction_id uuid REFERENCES public.savings_transactions(id),
  period_id uuid REFERENCES public.contribution_periods(id),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  allocation_period text,
  status text NOT NULL DEFAULT 'ALLOCATED',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contribution_allocations TO authenticated;
GRANT ALL ON public.contribution_allocations TO service_role;
ALTER TABLE public.contribution_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calloc_read" ON public.contribution_allocations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid())
    OR public.has_permission(cooperative_id, 'savings.view', auth.uid())
    OR public.can_admin_cooperative(cooperative_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );
CREATE POLICY "calloc_write" ON public.contribution_allocations FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'savings.create', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'savings.create', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));

-- IMMUTABILITY OF POSTED SAVINGS TRANSACTIONS
CREATE OR REPLACE FUNCTION public.enforce_savings_transaction_immutability()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Savings transactions cannot be deleted. Post a reversal instead.';
  END IF;
  IF OLD.status = 'POSTED' THEN
    IF NEW.status NOT IN ('POSTED','REVERSED') THEN
      RAISE EXCEPTION 'A posted savings transaction cannot be changed. Post a reversal instead.';
    END IF;
    IF NEW.amount <> OLD.amount OR NEW.direction <> OLD.direction
       OR NEW.savings_account_id <> OLD.savings_account_id
       OR NEW.transaction_type <> OLD.transaction_type
       OR NEW.value_date <> OLD.value_date THEN
      RAISE EXCEPTION 'A posted savings transaction cannot be changed. Post a reversal instead.';
    END IF;
    IF NEW.status = 'REVERSED' AND coalesce(NEW.reversal_reason,'') = '' THEN
      RAISE EXCEPTION 'A reason is required to reverse a savings transaction.';
    END IF;
  END IF;
  IF NEW.status = 'POSTED' AND OLD.status <> 'POSTED' THEN
    NEW.posted_at := now();
    NEW.posted_by := coalesce(NEW.posted_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_stx_immutable BEFORE UPDATE OR DELETE ON public.savings_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_savings_transaction_immutability();

-- BALANCE RECALCULATION FROM POSTED TRANSACTIONS
CREATE OR REPLACE FUNCTION public.recalc_savings_account_balance(_account_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _credits numeric(18,2);
  _debits numeric(18,2);
  _last date;
BEGIN
  SELECT
    coalesce(sum(amount) FILTER (WHERE direction = 'CREDIT'),0),
    coalesce(sum(amount) FILTER (WHERE direction = 'DEBIT'),0),
    max(transaction_date)
  INTO _credits, _debits, _last
  FROM public.savings_transactions
  WHERE savings_account_id = _account_id AND status = 'POSTED';

  UPDATE public.member_savings_accounts a
  SET current_balance = _credits - _debits,
      available_balance = (_credits - _debits) - a.locked_balance,
      last_transaction_date = _last,
      updated_at = now()
  WHERE a.id = _account_id;
END;
$$;
REVOKE ALL ON FUNCTION public.recalc_savings_account_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalc_savings_account_balance(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.savings_balance_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalc_savings_account_balance(NEW.savings_account_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_stx_balance AFTER INSERT OR UPDATE ON public.savings_transactions
  FOR EACH ROW EXECUTE FUNCTION public.savings_balance_sync();

CREATE OR REPLACE FUNCTION public.savings_locked_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.available_balance := NEW.current_balance - NEW.locked_balance;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_msa_available BEFORE INSERT OR UPDATE ON public.member_savings_accounts
  FOR EACH ROW EXECUTE FUNCTION public.savings_locked_sync();

-- NUMBER GENERATORS
CREATE OR REPLACE FUNCTION public.next_savings_transaction_number(_cooperative_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n bigint;
BEGIN
  SELECT count(*) + 1 INTO _n FROM public.savings_transactions WHERE cooperative_id = _cooperative_id;
  RETURN 'SV-' || to_char(now(),'YYYYMM') || '-' || lpad(_n::text, 6, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.next_savings_transaction_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_savings_transaction_number(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.next_savings_account_number(_cooperative_id uuid, _member_id uuid, _product_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _fmt text; _member text; _product text; _seq int; _result text;
BEGIN
  SELECT coalesce(account_number_format,'{MEMBER}-{PRODUCT}'), product_code
    INTO _fmt, _product FROM public.savings_products WHERE id = _product_id;
  SELECT coalesce(member_number, membership_number) INTO _member FROM public.members WHERE id = _member_id;
  SELECT count(*) + 1 INTO _seq FROM public.member_savings_accounts WHERE cooperative_id = _cooperative_id;
  _result := replace(_fmt, '{MEMBER}', coalesce(_member,'MEM'));
  _result := replace(_result, '{PRODUCT}', coalesce(_product,'SAV'));
  _result := replace(_result, '{SEQ}', lpad(_seq::text,5,'0'));
  _result := replace(_result, '{YEAR}', to_char(now(),'YYYY'));
  IF EXISTS (SELECT 1 FROM public.member_savings_accounts WHERE cooperative_id = _cooperative_id AND account_number = _result) THEN
    _result := _result || '-' || lpad(_seq::text,3,'0');
  END IF;
  RETURN _result;
END;
$$;
REVOKE ALL ON FUNCTION public.next_savings_account_number(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_savings_account_number(uuid, uuid, uuid) TO authenticated, service_role;

-- ELIGIBILITY DATE FROM PRODUCT WAITING PERIOD
CREATE OR REPLACE FUNCTION public.set_savings_eligible_from()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _wait int;
BEGIN
  IF NEW.eligible_from_date IS NULL THEN
    SELECT coalesce(eligibility_wait_days,0) INTO _wait FROM public.savings_products WHERE id = NEW.savings_product_id;
    NEW.eligible_from_date := NEW.value_date + coalesce(_wait,0);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_stx_eligible BEFORE INSERT ON public.savings_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_savings_eligible_from();

-- updated_at + audit triggers
CREATE TRIGGER trg_sp_updated BEFORE UPDATE ON public.savings_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_msa_updated BEFORE UPDATE ON public.member_savings_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cp_updated BEFORE UPDATE ON public.contribution_periods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ccd_updated BEFORE UPDATE ON public.category_contribution_defaults FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_mcs_updated BEFORE UPDATE ON public.member_contribution_schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_smb_updated BEFORE UPDATE ON public.savings_migration_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_stx_updated BEFORE UPDATE ON public.savings_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_sp_audit AFTER INSERT OR UPDATE OR DELETE ON public.savings_products FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_msa_audit AFTER INSERT OR UPDATE OR DELETE ON public.member_savings_accounts FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_stx_audit AFTER INSERT OR UPDATE ON public.savings_transactions FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_mcs_audit AFTER INSERT OR UPDATE OR DELETE ON public.member_contribution_schedules FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_smb_audit AFTER INSERT OR UPDATE OR DELETE ON public.savings_migration_batches FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- PERMISSIONS CATALOGUE
INSERT INTO public.permissions (code, module, resource, action, description) VALUES
  ('savings.create','savings','savings','create','Record savings transactions'),
  ('savings.submit','savings','savings','submit','Submit savings transactions for checking'),
  ('savings.check','savings','savings','check','Check savings transactions'),
  ('savings.reverse','savings','savings','reverse','Reverse posted savings transactions'),
  ('savings.adjust','savings','savings','adjust','Post savings adjustments'),
  ('savings.import','savings','savings','import','Import savings contributions and opening balances'),
  ('savings.manage_products','savings','products','manage','Manage savings products'),
  ('savings.manage_rules','savings','rules','manage','Manage savings rules'),
  ('savings.manage_schedules','savings','schedules','manage','Manage contribution schedules and periods'),
  ('savings.calculate_bonus','savings','bonus','calculate','Calculate savings bonus'),
  ('savings.approve_bonus','savings','bonus','approve','Approve savings bonus'),
  ('savings.post_bonus','savings','bonus','post','Post savings bonus'),
  ('savings.view_reports','savings','reports','view','View savings reports')
ON CONFLICT (code) DO NOTHING;

-- grant savings permissions to finance-facing roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE p.module = 'savings'
  AND r.key IN ('COOPERATIVE_ADMIN','TREASURER','ACCOUNTANT')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE p.code IN ('savings.view','savings.view_reports')
  AND r.key IN ('COOPERATIVE_MANAGER','AUDITOR','SECRETARY','CHECKER','APPROVER')
ON CONFLICT DO NOTHING;

-- SAMPLE (EDITABLE) PRODUCTS PER EXISTING COOPERATIVE
INSERT INTO public.savings_products (cooperative_id, product_code, product_name, description, product_type, minimum_contribution, contribution_frequency, withdrawal_percentage_limit, withdrawal_notice_days, eligibility_wait_days, bonus_eligible, loan_eligibility_enabled, is_sample, account_number_format)
SELECT c.id, 'ORD', 'Ordinary Savings', 'Sample configuration — core recurring member savings. Edit to match your cooperative.', 'ORDINARY', 5000, 'MONTHLY', 50, 30, 0, true, true, true, '{MEMBER}-ORD'
FROM public.cooperatives c
ON CONFLICT (cooperative_id, product_code) DO NOTHING;

INSERT INTO public.savings_products (cooperative_id, product_code, product_name, description, product_type, minimum_contribution, contribution_frequency, withdrawal_percentage_limit, withdrawal_notice_days, eligibility_wait_days, bonus_eligible, loan_eligibility_enabled, is_sample, account_number_format)
SELECT c.id, 'SPC', 'Special Savings', 'Sample configuration — additional voluntary savings with a waiting period before it counts towards loans. Edit to match your cooperative.', 'SPECIAL', 0, 'MONTHLY', 100, 30, 90, true, true, true, '{MEMBER}-SPC'
FROM public.cooperatives c
ON CONFLICT (cooperative_id, product_code) DO NOTHING;

-- SAVINGS RULES (effective dated, editable)
INSERT INTO public.cooperative_rules (cooperative_id, rule_key, rule_name, description, category, value_type, numeric_value, effective_from, active)
SELECT c.id, 'special_savings_eligibility_wait_days', 'Special savings waiting period (days)', 'Days after a special savings contribution before it counts towards loan and interest calculations.', 'savings', 'NUMERIC', 90, CURRENT_DATE, true
FROM public.cooperatives c
ON CONFLICT DO NOTHING;

INSERT INTO public.cooperative_rules (cooperative_id, rule_key, rule_name, description, category, value_type, numeric_value, effective_from, active)
SELECT c.id, 'savings_withdrawal_percentage_limit', 'Maximum savings withdrawal (%)', 'Maximum share of regular savings a member may withdraw at once.', 'savings', 'NUMERIC', 50, CURRENT_DATE, true
FROM public.cooperatives c
ON CONFLICT DO NOTHING;

INSERT INTO public.cooperative_rules (cooperative_id, rule_key, rule_name, description, category, value_type, numeric_value, effective_from, active)
SELECT c.id, 'savings_withdrawal_frequency_days', 'Days between savings withdrawals', 'Minimum number of days between one savings withdrawal and the next.', 'savings', 'NUMERIC', 90, CURRENT_DATE, true
FROM public.cooperatives c
ON CONFLICT DO NOTHING;

INSERT INTO public.cooperative_rules (cooperative_id, rule_key, rule_name, description, category, value_type, boolean_value, effective_from, active)
SELECT c.id, 'savings_allow_negative_balance', 'Allow negative savings balance', 'When off, a savings account can never be taken below zero.', 'savings', 'BOOLEAN', false, CURRENT_DATE, true
FROM public.cooperatives c
ON CONFLICT DO NOTHING;
