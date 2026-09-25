-- ============ 1. ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.journal_status AS ENUM ('DRAFT','SUBMITTED','CHECKED','APPROVED','POSTED','REJECTED','REVERSED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.normal_balance AS ENUM ('DEBIT','CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.accounting_exception_status AS ENUM ('OPEN','RESOLVED','IGNORED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ 2. CHART OF ACCOUNTS ============
ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS account_subtype text,
  ADD COLUMN IF NOT EXISTS normal_balance public.normal_balance,
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_manual_posting boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_member boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_loan boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_bank_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_cost_centre boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_department boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN';

UPDATE public.chart_of_accounts
   SET normal_balance = CASE WHEN account_type IN ('ASSET','EXPENSE') THEN 'DEBIT'::public.normal_balance
                             ELSE 'CREDIT'::public.normal_balance END
 WHERE normal_balance IS NULL;

ALTER TABLE public.chart_of_accounts ALTER COLUMN normal_balance SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coa_coop_code ON public.chart_of_accounts (cooperative_id, code);
CREATE INDEX IF NOT EXISTS idx_coa_parent ON public.chart_of_accounts (parent_id);

-- ============ 3. JOURNAL ENTRIES / LINES ============
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS journal_number text,
  ADD COLUMN IF NOT EXISTS journal_type text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS total_debit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_credit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS reversal_of_id uuid REFERENCES public.journal_entries(id),
  ADD COLUMN IF NOT EXISTS reversal_reason text,
  ADD COLUMN IF NOT EXISTS checked_by uuid,
  ADD COLUMN IF NOT EXISTS checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS posted_by uuid;

-- switch journal status onto a dedicated accounting status
DROP TRIGGER IF EXISTS trg_je_posting ON public.journal_entries;
DROP TRIGGER IF EXISTS trg_jl_protect ON public.journal_lines;

ALTER TABLE public.journal_entries
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.journal_status
    USING (CASE WHEN status::text = 'COMPLETED' THEN 'POSTED' ELSE status::text END)::public.journal_status,
  ALTER COLUMN status SET DEFAULT 'DRAFT'::public.journal_status;

CREATE UNIQUE INDEX IF NOT EXISTS uq_je_number ON public.journal_entries (cooperative_id, journal_number) WHERE journal_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_je_source ON public.journal_entries (cooperative_id, source_type, source_id, journal_type) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_je_coop_date ON public.journal_entries (cooperative_id, posting_date);
CREATE INDEX IF NOT EXISTS idx_je_period ON public.journal_entries (period_id);
CREATE INDEX IF NOT EXISTS idx_je_status ON public.journal_entries (cooperative_id, status);

ALTER TABLE public.journal_lines
  ADD COLUMN IF NOT EXISTS member_id uuid,
  ADD COLUMN IF NOT EXISTS loan_id uuid,
  ADD COLUMN IF NOT EXISTS bank_account_id uuid,
  ADD COLUMN IF NOT EXISTS cost_centre_id uuid,
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS line_sequence integer NOT NULL DEFAULT 1;

ALTER TABLE public.journal_lines DROP CONSTRAINT IF EXISTS jl_sides_check;
ALTER TABLE public.journal_lines ADD CONSTRAINT jl_sides_check
  CHECK (debit >= 0 AND credit >= 0 AND NOT (debit > 0 AND credit > 0));

CREATE INDEX IF NOT EXISTS idx_jl_journal ON public.journal_lines (journal_id);
CREATE INDEX IF NOT EXISTS idx_jl_account ON public.journal_lines (account_id);
CREATE INDEX IF NOT EXISTS idx_jl_member ON public.journal_lines (member_id);
CREATE INDEX IF NOT EXISTS idx_jl_loan ON public.journal_lines (loan_id);

-- posting rules
CREATE OR REPLACE FUNCTION public.enforce_journal_posting_rules()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE td numeric; tc numeric; p_status public.period_status;
BEGIN
  IF NEW.status = 'POSTED' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'POSTED') THEN
    SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO td, tc
      FROM public.journal_lines WHERE journal_id = NEW.id;
    IF td <> tc OR td = 0 THEN
      RAISE EXCEPTION 'Journal is unbalanced: debits % <> credits %', td, tc;
    END IF;
    IF NEW.period_id IS NOT NULL THEN
      SELECT status INTO p_status FROM public.accounting_periods WHERE id = NEW.period_id;
      IF p_status = 'CLOSED' THEN
        RAISE EXCEPTION 'Cannot post into a CLOSED accounting period.';
      END IF;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.journal_lines l
        JOIN public.chart_of_accounts a ON a.id = l.account_id
       WHERE l.journal_id = NEW.id AND a.is_active = false
    ) THEN
      RAISE EXCEPTION 'An inactive account cannot receive new postings.';
    END IF;
    NEW.total_debit := td;
    NEW.total_credit := tc;
    NEW.posted_at := COALESCE(NEW.posted_at, now());
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'POSTED' AND NEW.status NOT IN ('POSTED','REVERSED') THEN
    RAISE EXCEPTION 'Posted journals are immutable.';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.protect_posted_journal_lines()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE j_status public.journal_status;
BEGIN
  SELECT status INTO j_status FROM public.journal_entries WHERE id = COALESCE(NEW.journal_id, OLD.journal_id);
  IF j_status = 'POSTED' THEN
    RAISE EXCEPTION 'Lines of a posted journal cannot be changed.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $function$;

CREATE OR REPLACE FUNCTION public.protect_posted_journals()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF OLD.status IN ('POSTED','REVERSED') THEN
    RAISE EXCEPTION 'Posted journals can never be deleted. Post a reversal instead.';
  END IF;
  RETURN OLD;
END; $function$;

CREATE TRIGGER trg_je_posting BEFORE INSERT OR UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_journal_posting_rules();
CREATE TRIGGER trg_je_no_delete BEFORE DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.protect_posted_journals();
CREATE TRIGGER trg_jl_protect BEFORE INSERT OR UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.protect_posted_journal_lines();

-- ============ 4. NEW TABLES ============
CREATE TABLE IF NOT EXISTS public.accounting_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  dimension_type text NOT NULL CHECK (dimension_type IN ('COST_CENTRE','DEPARTMENT','PROJECT','FUND')),
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (cooperative_id, dimension_type, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_dimensions TO authenticated;
GRANT ALL ON public.accounting_dimensions TO service_role;
ALTER TABLE public.accounting_dimensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dimensions readable by cooperative" ON public.accounting_dimensions FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "dimensions managed with accounting.edit" ON public.accounting_dimensions FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()));

CREATE TABLE IF NOT EXISTS public.accounting_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  event_code text NOT NULL,
  description text,
  debit_account_id uuid REFERENCES public.chart_of_accounts(id),
  credit_account_id uuid REFERENCES public.chart_of_accounts(id),
  savings_product_id uuid REFERENCES public.savings_products(id),
  loan_product_id uuid REFERENCES public.loan_products(id),
  withdrawal_type_id uuid REFERENCES public.withdrawal_types(id),
  source_channel text,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
CREATE INDEX IF NOT EXISTS idx_map_lookup ON public.accounting_mappings (cooperative_id, event_code, is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_mappings TO authenticated;
GRANT ALL ON public.accounting_mappings TO service_role;
ALTER TABLE public.accounting_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mappings readable by cooperative" ON public.accounting_mappings FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "mappings managed with accounting.edit" ON public.accounting_mappings FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()));

CREATE TABLE IF NOT EXISTS public.journal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  journal_type text NOT NULL DEFAULT 'MANUAL',
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  auto_post boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_templates TO authenticated;
GRANT ALL ON public.journal_templates TO service_role;
ALTER TABLE public.journal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates readable by cooperative" ON public.journal_templates FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "templates managed with accounting.edit" ON public.journal_templates FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()));

CREATE TABLE IF NOT EXISTS public.recurring_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.journal_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('MONTHLY','QUARTERLY','ANNUAL','CUSTOM')),
  interval_days integer,
  next_run_date date NOT NULL,
  end_date date,
  amount numeric,
  requires_approval boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  last_run_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_journals TO authenticated;
GRANT ALL ON public.recurring_journals TO service_role;
ALTER TABLE public.recurring_journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recurring readable by cooperative" ON public.recurring_journals FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "recurring managed with accounting.edit" ON public.recurring_journals FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()));

CREATE TABLE IF NOT EXISTS public.accounting_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  event_code text NOT NULL,
  source_type text,
  source_id uuid,
  amount numeric,
  reason text NOT NULL,
  details jsonb,
  status public.accounting_exception_status NOT NULL DEFAULT 'OPEN',
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_note text,
  journal_id uuid REFERENCES public.journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acc_exc ON public.accounting_exceptions (cooperative_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_exc_open ON public.accounting_exceptions (cooperative_id, event_code, source_type, source_id) WHERE status = 'OPEN' AND source_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_exceptions TO authenticated;
GRANT ALL ON public.accounting_exceptions TO service_role;
ALTER TABLE public.accounting_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exceptions readable by cooperative" ON public.accounting_exceptions FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "exceptions managed with accounting.post" ON public.accounting_exceptions FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'accounting.post', auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'accounting.post', auth.uid()));

CREATE TABLE IF NOT EXISTS public.accruals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  accrual_type text NOT NULL CHECK (accrual_type IN ('EXPENSE','INCOME','INTEREST','OTHER')),
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  accrual_date date NOT NULL,
  expense_account_id uuid REFERENCES public.chart_of_accounts(id),
  liability_account_id uuid REFERENCES public.chart_of_accounts(id),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','POSTED','SETTLED','CANCELLED')),
  journal_id uuid REFERENCES public.journal_entries(id),
  settlement_journal_id uuid REFERENCES public.journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accruals TO authenticated;
GRANT ALL ON public.accruals TO service_role;
ALTER TABLE public.accruals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accruals readable by cooperative" ON public.accruals FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "accruals managed with accounting.edit" ON public.accruals FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()));

CREATE TABLE IF NOT EXISTS public.prepayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  description text NOT NULL,
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  recognised_amount numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  months integer NOT NULL CHECK (months > 0),
  prepayment_account_id uuid REFERENCES public.chart_of_accounts(id),
  expense_account_id uuid REFERENCES public.chart_of_accounts(id),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prepayments TO authenticated;
GRANT ALL ON public.prepayments TO service_role;
ALTER TABLE public.prepayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prepayments readable by cooperative" ON public.prepayments FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "prepayments managed with accounting.edit" ON public.prepayments FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()));

CREATE TABLE IF NOT EXISTS public.prepayment_schedule_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  prepayment_id uuid NOT NULL REFERENCES public.prepayments(id) ON DELETE CASCADE,
  recognition_date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  journal_id uuid REFERENCES public.journal_entries(id),
  recognised boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prepayment_schedule_lines TO authenticated;
GRANT ALL ON public.prepayment_schedule_lines TO service_role;
ALTER TABLE public.prepayment_schedule_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prepayment lines readable by cooperative" ON public.prepayment_schedule_lines FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "prepayment lines managed with accounting.edit" ON public.prepayment_schedule_lines FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()));

CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  asset_number text NOT NULL,
  asset_name text NOT NULL,
  category text,
  acquisition_date date NOT NULL,
  cost numeric NOT NULL CHECK (cost >= 0),
  useful_life_months integer NOT NULL CHECK (useful_life_months > 0),
  depreciation_method text NOT NULL DEFAULT 'STRAIGHT_LINE' CHECK (depreciation_method IN ('STRAIGHT_LINE','REDUCING_BALANCE')),
  residual_value numeric NOT NULL DEFAULT 0,
  accumulated_depreciation numeric NOT NULL DEFAULT 0,
  asset_account_id uuid REFERENCES public.chart_of_accounts(id),
  depreciation_expense_account_id uuid REFERENCES public.chart_of_accounts(id),
  accumulated_depreciation_account_id uuid REFERENCES public.chart_of_accounts(id),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISPOSED','WRITTEN_OFF')),
  disposal_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (cooperative_id, asset_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_assets TO authenticated;
GRANT ALL ON public.fixed_assets TO service_role;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets readable by cooperative" ON public.fixed_assets FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "assets managed with accounting.edit" ON public.fixed_assets FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'accounting.edit', auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_dim_upd BEFORE UPDATE ON public.accounting_dimensions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_map_upd BEFORE UPDATE ON public.accounting_mappings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_jt_upd BEFORE UPDATE ON public.journal_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rj_upd BEFORE UPDATE ON public.recurring_journals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ax_upd BEFORE UPDATE ON public.accounting_exceptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_acc_upd BEFORE UPDATE ON public.accruals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pre_upd BEFORE UPDATE ON public.prepayments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_fa_upd BEFORE UPDATE ON public.fixed_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- audit triggers
CREATE TRIGGER trg_map_audit AFTER INSERT OR UPDATE OR DELETE ON public.accounting_mappings FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_coa_audit AFTER INSERT OR UPDATE OR DELETE ON public.fixed_assets FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ============ 5. NUMBERING ============
CREATE OR REPLACE FUNCTION public.next_journal_number(_cooperative_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  SELECT COUNT(*) + 1 INTO n FROM public.journal_entries WHERE cooperative_id = _cooperative_id;
  RETURN 'JV-' || LPAD(n::text, 6, '0');
END; $$;
GRANT EXECUTE ON FUNCTION public.next_journal_number(uuid) TO authenticated;

-- ============ 6. POSTING ENGINE ============
CREATE OR REPLACE FUNCTION public.resolve_accounting_mapping(
  _cooperative_id uuid, _event_code text, _savings_product_id uuid DEFAULT NULL,
  _loan_product_id uuid DEFAULT NULL, _withdrawal_type_id uuid DEFAULT NULL, _source_channel text DEFAULT NULL
) RETURNS public.accounting_mappings
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT m.* FROM public.accounting_mappings m
   WHERE m.cooperative_id = _cooperative_id
     AND m.event_code = _event_code
     AND m.is_active
     AND (m.savings_product_id IS NULL OR m.savings_product_id = _savings_product_id)
     AND (m.loan_product_id IS NULL OR m.loan_product_id = _loan_product_id)
     AND (m.withdrawal_type_id IS NULL OR m.withdrawal_type_id = _withdrawal_type_id)
     AND (m.source_channel IS NULL OR m.source_channel = _source_channel)
   ORDER BY
     (m.savings_product_id IS NOT NULL)::int + (m.loan_product_id IS NOT NULL)::int
     + (m.withdrawal_type_id IS NOT NULL)::int + (m.source_channel IS NOT NULL)::int DESC,
     m.priority DESC
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_accounting_mapping(uuid, text, uuid, uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.post_accounting_event(
  _cooperative_id uuid,
  _event_code text,
  _source_type text,
  _source_id uuid,
  _journal_date date,
  _amount numeric,
  _description text DEFAULT NULL,
  _reference text DEFAULT NULL,
  _member_id uuid DEFAULT NULL,
  _loan_id uuid DEFAULT NULL,
  _savings_product_id uuid DEFAULT NULL,
  _loan_product_id uuid DEFAULT NULL,
  _withdrawal_type_id uuid DEFAULT NULL,
  _source_channel text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  m public.accounting_mappings;
  p_id uuid; p_status public.period_status;
  j_id uuid; j_no text; fail text;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN NULL; END IF;

  -- idempotency: one journal per source event
  SELECT id INTO j_id FROM public.journal_entries
   WHERE cooperative_id = _cooperative_id AND source_type = _source_type
     AND source_id = _source_id AND journal_type = _event_code;
  IF j_id IS NOT NULL THEN RETURN j_id; END IF;

  SELECT * INTO m FROM public.resolve_accounting_mapping(
    _cooperative_id, _event_code, _savings_product_id, _loan_product_id, _withdrawal_type_id, _source_channel);

  IF m.id IS NULL OR m.debit_account_id IS NULL OR m.credit_account_id IS NULL THEN
    fail := 'No accounting mapping is configured for ' || _event_code || '.';
  ELSE
    SELECT id, status INTO p_id, p_status FROM public.accounting_periods
     WHERE cooperative_id = _cooperative_id AND _journal_date BETWEEN start_date AND end_date
     LIMIT 1;
    IF p_id IS NULL THEN
      fail := 'No accounting period covers ' || _journal_date || '.';
    ELSIF p_status = 'CLOSED' THEN
      fail := 'The accounting period covering ' || _journal_date || ' is closed.';
    END IF;
  END IF;

  IF fail IS NOT NULL THEN
    INSERT INTO public.accounting_exceptions (cooperative_id, event_code, source_type, source_id, amount, reason, details)
    VALUES (_cooperative_id, _event_code, _source_type, _source_id, _amount, fail,
            jsonb_build_object('journal_date', _journal_date, 'member_id', _member_id, 'loan_id', _loan_id))
    ON CONFLICT DO NOTHING;
    RETURN NULL;
  END IF;

  j_no := public.next_journal_number(_cooperative_id);

  INSERT INTO public.journal_entries (
    cooperative_id, journal_number, journal_type, period_id, posting_date, description,
    source_type, source_id, reference, currency, status, created_by, posted_by, posted_at,
    total_debit, total_credit)
  VALUES (_cooperative_id, j_no, _event_code, p_id, _journal_date,
    COALESCE(_description, _event_code), _source_type, _source_id, _reference, 'NGN',
    'DRAFT', auth.uid(), auth.uid(), now(), 0, 0)
  RETURNING id INTO j_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description, member_id, loan_id, reference, line_sequence)
  VALUES (j_id, m.debit_account_id, _amount, 0, _description, _member_id, _loan_id, _reference, 1),
         (j_id, m.credit_account_id, 0, _amount, _description, _member_id, _loan_id, _reference, 2);

  UPDATE public.journal_entries SET status = 'POSTED' WHERE id = j_id;

  -- clear any earlier exception for this event
  UPDATE public.accounting_exceptions
     SET status = 'RESOLVED', resolved_at = now(), journal_id = j_id,
         resolution_note = 'Posted automatically on retry.'
   WHERE cooperative_id = _cooperative_id AND event_code = _event_code
     AND source_type = _source_type AND source_id = _source_id AND status = 'OPEN';

  RETURN j_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.post_accounting_event(uuid, text, text, uuid, date, numeric, text, text, uuid, uuid, uuid, uuid, uuid, text) TO authenticated;

-- ============ 7. AUTOMATED POSTING TRIGGERS ============
CREATE OR REPLACE FUNCTION public.accounting_on_savings_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ev text;
BEGIN
  IF NEW.status::text <> 'POSTED' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'POSTED' THEN RETURN NEW; END IF;

  IF NEW.direction::text = 'CREDIT' THEN
    ev := CASE
      WHEN NEW.source::text = 'CHECK_OFF' THEN 'CHECKOFF_RECEIVED'
      WHEN NEW.transaction_type::text = 'INTEREST_CREDIT' THEN 'SAVINGS_INTEREST_CREDITED'
      WHEN NEW.transaction_type::text = 'BONUS_CREDIT' THEN 'SAVINGS_BONUS_CREDITED'
      WHEN NEW.transaction_type::text = 'OPENING_BALANCE' THEN 'SAVINGS_OPENING_BALANCE'
      ELSE 'SAVINGS_CONTRIBUTION_POSTED' END;
  ELSE
    ev := CASE
      WHEN NEW.transaction_type::text = 'REVERSAL' THEN 'SAVINGS_REVERSAL_POSTED'
      ELSE 'SAVINGS_WITHDRAWAL_POSTED' END;
  END IF;

  PERFORM public.post_accounting_event(
    NEW.cooperative_id, ev, 'SAVINGS_TRANSACTION', NEW.id, NEW.transaction_date, NEW.amount,
    COALESCE(NEW.description, ev) , NEW.transaction_number, NEW.member_id, NULL,
    NEW.savings_product_id, NULL, NULL, NEW.source::text);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_stx_accounting AFTER INSERT OR UPDATE ON public.savings_transactions
  FOR EACH ROW EXECUTE FUNCTION public.accounting_on_savings_transaction();

CREATE OR REPLACE FUNCTION public.accounting_on_loan_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ev text; prod uuid;
BEGIN
  IF NEW.status::text <> 'POSTED' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'POSTED' THEN RETURN NEW; END IF;

  ev := CASE NEW.transaction_type::text
    WHEN 'DISBURSEMENT' THEN 'LOAN_DISBURSED'
    WHEN 'INTEREST_ACCRUAL' THEN 'LOAN_INTEREST_ACCRUED'
    WHEN 'PENALTY_CHARGE' THEN 'LOAN_PENALTY_CHARGED'
    WHEN 'FEE_CHARGE' THEN 'LOAN_FEE_CHARGED'
    WHEN 'PRINCIPAL_REPAYMENT' THEN 'LOAN_PRINCIPAL_REPAID'
    WHEN 'INTEREST_REPAYMENT' THEN 'LOAN_INTEREST_REPAID'
    WHEN 'FEE_REPAYMENT' THEN 'LOAN_FEE_REPAID'
    WHEN 'PENALTY_REPAYMENT' THEN 'LOAN_PENALTY_REPAID'
    WHEN 'WRITE_OFF' THEN 'LOAN_WRITTEN_OFF'
    ELSE NULL END;
  IF ev IS NULL THEN RETURN NEW; END IF;

  SELECT loan_product_id INTO prod FROM public.loans WHERE id = NEW.loan_id;

  PERFORM public.post_accounting_event(
    NEW.cooperative_id, ev, 'LOAN_TRANSACTION', NEW.id, NEW.transaction_date, NEW.amount,
    COALESCE(NEW.narration, ev), NEW.transaction_number, NEW.member_id, NEW.loan_id,
    NULL, prod, NULL, NEW.source::text);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_ltx_accounting AFTER INSERT OR UPDATE ON public.loan_transactions
  FOR EACH ROW EXECUTE FUNCTION public.accounting_on_loan_transaction();

CREATE OR REPLACE FUNCTION public.accounting_on_checkoff_settlement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status::text NOT IN ('SETTLED','RECEIVED','RECONCILED','COMPLETED') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = NEW.status::text THEN RETURN NEW; END IF;
  PERFORM public.post_accounting_event(
    NEW.cooperative_id, 'CHECKOFF_SETTLEMENT_RECEIVED', 'CHECKOFF_SETTLEMENT', NEW.id,
    COALESCE(NEW.actual_settlement_date, NEW.expected_settlement_date, CURRENT_DATE),
    COALESCE(NEW.actual_amount, NEW.expected_amount),
    'Employer settlement received', NEW.bank_reference);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_cos_accounting AFTER INSERT OR UPDATE ON public.checkoff_settlements
  FOR EACH ROW EXECUTE FUNCTION public.accounting_on_checkoff_settlement();

CREATE OR REPLACE FUNCTION public.accounting_on_withdrawal_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status::text <> 'COMPLETED' OR COALESCE(NEW.fee_amount,0) <= 0 THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'COMPLETED' THEN RETURN NEW; END IF;
  PERFORM public.post_accounting_event(
    NEW.cooperative_id, 'WITHDRAWAL_FEE_CHARGED', 'WITHDRAWAL_REQUEST', NEW.id,
    COALESCE(NEW.completed_at::date, CURRENT_DATE), NEW.fee_amount,
    'Withdrawal fee', NEW.withdrawal_number, NEW.member_id, NULL,
    NEW.savings_product_id, NULL, NEW.withdrawal_type_id);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_wr_accounting AFTER INSERT OR UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.accounting_on_withdrawal_fee();

-- ============ 8. SAMPLE CHART OF ACCOUNTS + DEFAULT MAPPINGS ============
CREATE OR REPLACE FUNCTION public.seed_sample_chart_of_accounts(_cooperative_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer := 0;
BEGIN
  IF NOT public.has_permission(_cooperative_id, 'accounting.edit', auth.uid()) THEN
    RAISE EXCEPTION 'You do not have permission to configure accounting.';
  END IF;

  WITH sample(code, name, atype, subtype, sys) AS (VALUES
    ('1000','Cash & Bank','ASSET','CASH',true),
    ('1010','Cooperative Bank Accounts','ASSET','BANK',true),
    ('1020','Cash on Hand','ASSET','CASH',true),
    ('1100','Member Loans Receivable','ASSET','LOANS',true),
    ('1110','Loan Principal Receivable','ASSET','LOANS',true),
    ('1120','Interest Receivable','ASSET','LOANS',true),
    ('1130','Loan Fees Receivable','ASSET','LOANS',true),
    ('1140','Penalty Receivable','ASSET','LOANS',true),
    ('1150','Check-off Receivable','ASSET','RECEIVABLE',true),
    ('1200','Investments','ASSET','INVESTMENT',false),
    ('1210','Treasury Investments','ASSET','INVESTMENT',false),
    ('1220','Fixed Deposits','ASSET','INVESTMENT',false),
    ('1230','Investment Accrued Income','ASSET','INVESTMENT',false),
    ('1300','Other Receivables','ASSET','RECEIVABLE',false),
    ('1400','Prepayments','ASSET','PREPAYMENT',false),
    ('1500','Fixed Assets','ASSET','FIXED_ASSET',false),
    ('1510','Accumulated Depreciation','ASSET','FIXED_ASSET',false),
    ('1900','Suspense / Unapplied Cash','ASSET','SUSPENSE',true),
    ('1910','Withdrawal Clearing','ASSET','SUSPENSE',true),
    ('2000','Member Savings','LIABILITY','SAVINGS',true),
    ('2010','Regular Savings Liability','LIABILITY','SAVINGS',true),
    ('2020','Special Savings Liability','LIABILITY','SAVINGS',true),
    ('2100','Member Deposits / Other Liabilities','LIABILITY','OTHER',false),
    ('2200','Payables','LIABILITY','PAYABLE',false),
    ('2300','Accrued Expenses','LIABILITY','ACCRUAL',false),
    ('2400','External Borrowings','LIABILITY','BORROWING',false),
    ('2500','Other Liabilities','LIABILITY','OTHER',false),
    ('3000','Share Capital','EQUITY','CAPITAL',true),
    ('3100','Statutory Reserves','EQUITY','RESERVE',false),
    ('3200','General Reserves','EQUITY','RESERVE',false),
    ('3300','Retained Surplus','EQUITY','SURPLUS',true),
    ('3400','Current Year Surplus','EQUITY','SURPLUS',true),
    ('4000','Loan Interest Income','INCOME','INTEREST',true),
    ('4100','Loan Processing Fees','INCOME','FEES',true),
    ('4200','Penalty Income','INCOME','PENALTY',true),
    ('4300','Investment Income','INCOME','INVESTMENT',false),
    ('4400','Membership/Registration Fees','INCOME','FEES',false),
    ('4500','Other Operating Income','INCOME','OTHER',false),
    ('4600','Withdrawal Fee Income','INCOME','FEES',true),
    ('5000','Staff Costs','EXPENSE','STAFF',false),
    ('5100','Administrative Expenses','EXPENSE','ADMIN',false),
    ('5200','Bank Charges','EXPENSE','BANK',false),
    ('5300','Interest Expense','EXPENSE','INTEREST',false),
    ('5310','Savings Interest & Bonus Expense','EXPENSE','INTEREST',true),
    ('5400','Depreciation','EXPENSE','DEPRECIATION',false),
    ('5500','Professional Fees','EXPENSE','ADMIN',false),
    ('5600','Other Operating Expenses','EXPENSE','OTHER',false)
  )
  INSERT INTO public.chart_of_accounts (cooperative_id, code, name, account_type, account_subtype, normal_balance, is_system, created_by)
  SELECT _cooperative_id, s.code, s.name, s.atype::public.account_type, s.subtype,
         CASE WHEN s.atype IN ('ASSET','EXPENSE') THEN 'DEBIT'::public.normal_balance ELSE 'CREDIT'::public.normal_balance END,
         s.sys, auth.uid()
    FROM sample s
   WHERE NOT EXISTS (
     SELECT 1 FROM public.chart_of_accounts c WHERE c.cooperative_id = _cooperative_id AND c.code = s.code);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;
GRANT EXECUTE ON FUNCTION public.seed_sample_chart_of_accounts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.seed_default_accounting_mappings(_cooperative_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer := 0;
BEGIN
  IF NOT public.has_permission(_cooperative_id, 'accounting.edit', auth.uid()) THEN
    RAISE EXCEPTION 'You do not have permission to configure accounting.';
  END IF;

  WITH defaults(event_code, dr, cr, descr) AS (VALUES
    ('SAVINGS_CONTRIBUTION_POSTED','1010','2010','Member contribution received'),
    ('SAVINGS_OPENING_BALANCE','1010','2010','Savings opening balance'),
    ('CHECKOFF_RECEIVED','1150','2010','Payroll deduction recorded before employer settlement'),
    ('CHECKOFF_SETTLEMENT_RECEIVED','1010','1150','Employer settlement received'),
    ('SAVINGS_WITHDRAWAL_POSTED','2010','1010','Savings withdrawal paid'),
    ('SAVINGS_REVERSAL_POSTED','2010','1010','Savings reversal'),
    ('SAVINGS_INTEREST_CREDITED','5310','2010','Savings interest credited'),
    ('SAVINGS_BONUS_CREDITED','5310','2010','Savings bonus credited'),
    ('WITHDRAWAL_FEE_CHARGED','2010','4600','Withdrawal fee'),
    ('LOAN_DISBURSED','1110','1010','Loan disbursed'),
    ('LOAN_INTEREST_ACCRUED','1120','4000','Loan interest accrued'),
    ('LOAN_FEE_CHARGED','1130','4100','Loan fee charged'),
    ('LOAN_PENALTY_CHARGED','1140','4200','Loan penalty charged'),
    ('LOAN_PRINCIPAL_REPAID','1010','1110','Loan principal repaid'),
    ('LOAN_INTEREST_REPAID','1010','1120','Loan interest repaid'),
    ('LOAN_FEE_REPAID','1010','1130','Loan fee repaid'),
    ('LOAN_PENALTY_REPAID','1010','1140','Loan penalty repaid'),
    ('LOAN_WRITTEN_OFF','5600','1110','Loan written off'),
    ('MEMBERSHIP_FEE_RECEIVED','1010','4400','Membership fee received'),
    ('SHARE_CAPITAL_RECEIVED','1010','3000','Share capital received'),
    ('INVESTMENT_INCOME_RECEIVED','1010','4300','Investment income received'),
    ('BANK_CHARGE_POSTED','5200','1010','Bank charge')
  )
  INSERT INTO public.accounting_mappings (cooperative_id, event_code, description, debit_account_id, credit_account_id, created_by)
  SELECT _cooperative_id, d.event_code, d.descr, da.id, ca.id, auth.uid()
    FROM defaults d
    JOIN public.chart_of_accounts da ON da.cooperative_id = _cooperative_id AND da.code = d.dr
    JOIN public.chart_of_accounts ca ON ca.cooperative_id = _cooperative_id AND ca.code = d.cr
   WHERE NOT EXISTS (
     SELECT 1 FROM public.accounting_mappings m
      WHERE m.cooperative_id = _cooperative_id AND m.event_code = d.event_code
        AND m.savings_product_id IS NULL AND m.loan_product_id IS NULL
        AND m.withdrawal_type_id IS NULL AND m.source_channel IS NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;
GRANT EXECUTE ON FUNCTION public.seed_default_accounting_mappings(uuid) TO authenticated;

-- ============ 9. RETRY / MANUAL POSTING HELPERS ============
CREATE OR REPLACE FUNCTION public.retry_accounting_exception(_exception_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e public.accounting_exceptions; j uuid; s record; l record;
BEGIN
  SELECT * INTO e FROM public.accounting_exceptions WHERE id = _exception_id;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Exception not found.'; END IF;
  IF NOT public.has_permission(e.cooperative_id, 'accounting.post', auth.uid()) THEN
    RAISE EXCEPTION 'You do not have permission to post accounting entries.';
  END IF;

  IF e.source_type = 'SAVINGS_TRANSACTION' THEN
    SELECT * INTO s FROM public.savings_transactions WHERE id = e.source_id;
    j := public.post_accounting_event(e.cooperative_id, e.event_code, e.source_type, e.source_id,
      s.transaction_date, s.amount, COALESCE(s.description, e.event_code), s.transaction_number,
      s.member_id, NULL, s.savings_product_id, NULL, NULL, s.source::text);
  ELSIF e.source_type = 'LOAN_TRANSACTION' THEN
    SELECT * INTO l FROM public.loan_transactions WHERE id = e.source_id;
    j := public.post_accounting_event(e.cooperative_id, e.event_code, e.source_type, e.source_id,
      l.transaction_date, l.amount, COALESCE(l.narration, e.event_code), l.transaction_number,
      l.member_id, l.loan_id, NULL, (SELECT loan_product_id FROM public.loans WHERE id = l.loan_id), NULL, l.source::text);
  ELSE
    RAISE EXCEPTION 'This exception must be resolved through its own module.';
  END IF;

  RETURN j;
END; $$;
GRANT EXECUTE ON FUNCTION public.retry_accounting_exception(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reverse_journal(_journal_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE j public.journal_entries; nid uuid; p_id uuid; p_status public.period_status;
BEGIN
  SELECT * INTO j FROM public.journal_entries WHERE id = _journal_id;
  IF j.id IS NULL THEN RAISE EXCEPTION 'Journal not found.'; END IF;
  IF NOT public.has_permission(j.cooperative_id, 'accounting.reverse', auth.uid()) THEN
    RAISE EXCEPTION 'You do not have permission to reverse journals.';
  END IF;
  IF j.status <> 'POSTED' THEN RAISE EXCEPTION 'Only a posted journal can be reversed.'; END IF;
  IF COALESCE(_reason,'') = '' THEN RAISE EXCEPTION 'A reason is required.'; END IF;

  SELECT id, status INTO p_id, p_status FROM public.accounting_periods
   WHERE cooperative_id = j.cooperative_id AND CURRENT_DATE BETWEEN start_date AND end_date LIMIT 1;
  IF p_id IS NULL THEN RAISE EXCEPTION 'No accounting period covers today.'; END IF;
  IF p_status = 'CLOSED' THEN RAISE EXCEPTION 'Today falls in a closed accounting period.'; END IF;

  INSERT INTO public.journal_entries (cooperative_id, journal_number, journal_type, period_id, posting_date,
    description, source_type, source_id, reference, currency, status, reversal_of_id, reversal_reason,
    created_by, posted_by, posted_at)
  VALUES (j.cooperative_id, public.next_journal_number(j.cooperative_id), 'REVERSAL', p_id, CURRENT_DATE,
    'Reversal of ' || COALESCE(j.journal_number, j.id::text), j.source_type, NULL, j.reference, j.currency,
    'DRAFT', j.id, _reason, auth.uid(), auth.uid(), now())
  RETURNING id INTO nid;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description, member_id, loan_id,
    bank_account_id, cost_centre_id, department_id, project_id, reference, line_sequence)
  SELECT nid, account_id, credit, debit, 'Reversal: ' || COALESCE(description,''), member_id, loan_id,
         bank_account_id, cost_centre_id, department_id, project_id, reference, line_sequence
    FROM public.journal_lines WHERE journal_id = j.id;

  UPDATE public.journal_entries SET status = 'POSTED' WHERE id = nid;
  UPDATE public.journal_entries SET status = 'REVERSED' WHERE id = j.id;
  RETURN nid;
END; $$;
GRANT EXECUTE ON FUNCTION public.reverse_journal(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.post_manual_journal(_journal_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE j public.journal_entries; p_id uuid; p_status public.period_status;
BEGIN
  SELECT * INTO j FROM public.journal_entries WHERE id = _journal_id;
  IF j.id IS NULL THEN RAISE EXCEPTION 'Journal not found.'; END IF;
  IF NOT public.has_permission(j.cooperative_id, 'accounting.post', auth.uid()) THEN
    RAISE EXCEPTION 'You do not have permission to post journals.';
  END IF;
  IF j.status <> 'APPROVED' THEN RAISE EXCEPTION 'Only an approved journal can be posted.'; END IF;
  IF j.created_by = auth.uid() AND j.approved_by = auth.uid() THEN
    RAISE EXCEPTION 'The person who raised a journal cannot also approve it.';
  END IF;

  SELECT id, status INTO p_id, p_status FROM public.accounting_periods
   WHERE cooperative_id = j.cooperative_id AND j.posting_date BETWEEN start_date AND end_date LIMIT 1;
  IF p_id IS NULL THEN RAISE EXCEPTION 'No accounting period covers this journal date.'; END IF;
  IF p_status = 'CLOSED' THEN RAISE EXCEPTION 'That accounting period is closed.'; END IF;

  UPDATE public.journal_entries
     SET status = 'POSTED', period_id = p_id, posted_by = auth.uid(), posted_at = now(),
         journal_number = COALESCE(journal_number, public.next_journal_number(j.cooperative_id))
   WHERE id = _journal_id;
  RETURN _journal_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.post_manual_journal(uuid) TO authenticated;

-- ============ 10. PERMISSIONS ============
INSERT INTO public.permissions (code, module, resource, action, description) VALUES
  ('accounting.approve','accounting','ledger','APPROVE','Approve journals'),
  ('accounting.close','accounting','period','CLOSE','Open, soft-close and close accounting periods'),
  ('accounting.configure','accounting','configuration','CONFIGURE','Configure the chart of accounts and accounting mappings')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.code IN ('accounting.approve','accounting.close','accounting.configure')
 WHERE r.key IN ('COOPERATIVE_ADMIN','COOPERATIVE_MANAGER','ACCOUNTANT','TREASURER','APPROVER')
ON CONFLICT DO NOTHING;