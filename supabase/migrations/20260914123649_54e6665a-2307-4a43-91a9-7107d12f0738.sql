
-- ============ ENUMS ============
CREATE TYPE public.loan_repayment_source AS ENUM ('CHECK_OFF','BANK_TRANSFER','DIRECT_DEBIT','CASH','INTERNAL_TRANSFER','SAVINGS_OFFSET','PORTAL','MANUAL_ADJUSTMENT','GUARANTOR_RECOVERY','RECOVERY_AFTER_WRITE_OFF','OTHER');
CREATE TYPE public.loan_repayment_status AS ENUM ('DRAFT','PENDING','MATCHED','CHECKED','APPROVED','POSTED','UNAPPLIED','REVERSED','FAILED','CANCELLED');
CREATE TYPE public.loan_allocation_status AS ENUM ('UNALLOCATED','PARTIALLY_ALLOCATED','FULLY_ALLOCATED');
CREATE TYPE public.loan_allocation_type AS ENUM ('PENALTY','PROCESSING_FEE','ADMIN_FEE','INSURANCE','INTEREST','PRINCIPAL','OTHER');
CREATE TYPE public.collection_case_status AS ENUM ('OPEN','CONTACTED','PROMISE_TO_PAY','ESCALATED','RESTRUCTURING','RECOVERY','LEGAL_REVIEW','RESOLVED','CLOSED');
CREATE TYPE public.collection_action_type AS ENUM ('SMS','EMAIL','PHONE_CALL','REMINDER','MEETING','PAYMENT_REQUEST','PROMISE_TO_PAY','GUARANTOR_CONTACT','EMPLOYER_ESCALATION','COMMITTEE_ESCALATION','RECOVERY_ACTION','LEGAL_REVIEW','OTHER');
CREATE TYPE public.collection_priority AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE public.promise_status AS ENUM ('PENDING','KEPT','PARTIALLY_KEPT','BROKEN','CANCELLED');
CREATE TYPE public.loan_request_status AS ENUM ('REQUESTED','UNDER_REVIEW','CHECKED','APPROVED','REJECTED','POSTED','EFFECTIVE','CANCELLED','EXPIRED','SETTLED','RECOVERED');

-- ============ LOAN PENALTY BALANCE ============
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS outstanding_penalties numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recalc_loan_balances(_loan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_disbursed numeric := 0;
  v_principal numeric := 0;
  v_interest_charged numeric := 0;
  v_interest_paid numeric := 0;
  v_fees_charged numeric := 0;
  v_fees_paid numeric := 0;
  v_penalty_charged numeric := 0;
  v_penalty_paid numeric := 0;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN transaction_type = 'DISBURSEMENT' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type IN ('DISBURSEMENT','RESTRUCTURE_ADJUSTMENT','ADJUSTMENT_DEBIT') THEN principal_component
                      WHEN transaction_type IN ('PRINCIPAL_REPAYMENT','WRITE_OFF','ADJUSTMENT_CREDIT') THEN -principal_component
                      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'INTEREST_ACCRUAL' THEN interest_component ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'INTEREST_REPAYMENT' THEN interest_component ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'FEE_CHARGE' THEN fee_component ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'FEE_REPAYMENT' THEN fee_component ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'PENALTY_CHARGE' THEN penalty_component ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type IN ('PENALTY_REPAYMENT','ADJUSTMENT_CREDIT') THEN penalty_component ELSE 0 END), 0)
  INTO v_disbursed, v_principal, v_interest_charged, v_interest_paid, v_fees_charged, v_fees_paid, v_penalty_charged, v_penalty_paid
  FROM public.loan_transactions
  WHERE loan_id = _loan_id AND status = 'POSTED';

  UPDATE public.loans
  SET disbursed_amount = v_disbursed,
      outstanding_principal = GREATEST(v_principal, 0),
      accrued_interest = v_interest_charged,
      outstanding_interest = GREATEST(v_interest_charged - v_interest_paid, 0),
      outstanding_fees = GREATEST(v_fees_charged - v_fees_paid, 0),
      outstanding_penalties = GREATEST(v_penalty_charged - v_penalty_paid, 0),
      total_outstanding = GREATEST(v_principal, 0)
                        + GREATEST(v_interest_charged - v_interest_paid, 0)
                        + GREATEST(v_fees_charged - v_fees_paid, 0)
                        + GREATEST(v_penalty_charged - v_penalty_paid, 0)
  WHERE id = _loan_id;
END;
$function$;

-- ============ REPAYMENTS ============
CREATE TABLE public.loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  repayment_number text NOT NULL,
  loan_id uuid REFERENCES public.loans(id) ON DELETE RESTRICT,
  member_id uuid REFERENCES public.members(id) ON DELETE RESTRICT,
  repayment_date date NOT NULL DEFAULT CURRENT_DATE,
  value_date date,
  posting_date date,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'NGN',
  payment_source public.loan_repayment_source NOT NULL DEFAULT 'MANUAL_ADJUSTMENT',
  payment_method text,
  bank_account_id uuid,
  external_reference text,
  internal_reference text,
  checkoff_batch_id uuid REFERENCES public.checkoff_batches(id) ON DELETE SET NULL,
  checkoff_line_id uuid REFERENCES public.checkoff_batch_lines(id) ON DELETE SET NULL,
  bank_transaction_id uuid,
  expected_amount numeric,
  variance_amount numeric,
  status public.loan_repayment_status NOT NULL DEFAULT 'DRAFT',
  allocation_status public.loan_allocation_status NOT NULL DEFAULT 'UNALLOCATED',
  allocated_amount numeric NOT NULL DEFAULT 0,
  unapplied_amount numeric NOT NULL DEFAULT 0,
  notes text,
  exception_reason text,
  reversal_of uuid REFERENCES public.loan_repayments(id) ON DELETE SET NULL,
  reversal_reason text,
  checked_by uuid,
  approved_by uuid,
  posted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (cooperative_id, repayment_number)
);
CREATE UNIQUE INDEX loan_repayments_checkoff_line_idx ON public.loan_repayments (checkoff_line_id) WHERE checkoff_line_id IS NOT NULL;
CREATE UNIQUE INDEX loan_repayments_external_ref_idx ON public.loan_repayments (cooperative_id, payment_source, external_reference) WHERE external_reference IS NOT NULL;
CREATE INDEX loan_repayments_loan_idx ON public.loan_repayments (loan_id, repayment_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_repayments TO authenticated;
GRANT ALL ON public.loan_repayments TO service_role;
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_repayments_staff ON public.loan_repayments FOR ALL TO authenticated
  USING (has_permission(cooperative_id, 'repayments.view', auth.uid()) OR has_permission(cooperative_id, 'loans.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_permission(cooperative_id, 'repayments.create', auth.uid()) OR has_permission(cooperative_id, 'repayments.post', auth.uid()) OR has_permission(cooperative_id, 'repayments.reverse', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()));
CREATE POLICY loan_repayments_member_read ON public.loan_repayments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = loan_repayments.member_id AND m.user_id = auth.uid()));

CREATE TABLE public.loan_repayment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  repayment_id uuid NOT NULL REFERENCES public.loan_repayments(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE RESTRICT,
  schedule_line_id uuid REFERENCES public.loan_schedule_lines(id) ON DELETE SET NULL,
  allocation_type public.loan_allocation_type NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  allocation_sequence integer NOT NULL DEFAULT 1,
  allocation_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX loan_repayment_allocations_repayment_idx ON public.loan_repayment_allocations (repayment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_repayment_allocations TO authenticated;
GRANT ALL ON public.loan_repayment_allocations TO service_role;
ALTER TABLE public.loan_repayment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_repayment_allocations_staff ON public.loan_repayment_allocations FOR ALL TO authenticated
  USING (has_permission(cooperative_id, 'repayments.view', auth.uid()) OR has_permission(cooperative_id, 'loans.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_permission(cooperative_id, 'repayments.post', auth.uid()) OR has_permission(cooperative_id, 'repayments.create', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()));
CREATE POLICY loan_repayment_allocations_member_read ON public.loan_repayment_allocations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loans l JOIN public.members m ON m.id = l.member_id WHERE l.id = loan_repayment_allocations.loan_id AND m.user_id = auth.uid()));

CREATE TABLE public.unapplied_loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  repayment_id uuid REFERENCES public.loan_repayments(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  loan_id uuid REFERENCES public.loans(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_source public.loan_repayment_source NOT NULL DEFAULT 'OTHER',
  reference text,
  reason text NOT NULL DEFAULT 'UNMATCHED',
  status text NOT NULL DEFAULT 'OPEN',
  resolution text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unapplied_loan_payments TO authenticated;
GRANT ALL ON public.unapplied_loan_payments TO service_role;
ALTER TABLE public.unapplied_loan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY unapplied_loan_payments_staff ON public.unapplied_loan_payments FOR ALL TO authenticated
  USING (has_permission(cooperative_id, 'repayments.view', auth.uid()) OR has_permission(cooperative_id, 'loans.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_permission(cooperative_id, 'repayments.create', auth.uid()) OR has_permission(cooperative_id, 'repayments.post', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()));

-- ============ DELINQUENCY ============
CREATE TABLE public.loan_delinquency_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  days_past_due integer NOT NULL DEFAULT 0,
  maximum_days_past_due integer NOT NULL DEFAULT 0,
  earliest_overdue_date date,
  last_payment_date date,
  outstanding_principal numeric NOT NULL DEFAULT 0,
  outstanding_interest numeric NOT NULL DEFAULT 0,
  outstanding_fees numeric NOT NULL DEFAULT 0,
  outstanding_penalties numeric NOT NULL DEFAULT 0,
  principal_arrears numeric NOT NULL DEFAULT 0,
  interest_arrears numeric NOT NULL DEFAULT 0,
  fee_arrears numeric NOT NULL DEFAULT 0,
  penalty_arrears numeric NOT NULL DEFAULT 0,
  total_arrears numeric NOT NULL DEFAULT 0,
  par_bucket text,
  delinquency_status text,
  npl boolean NOT NULL DEFAULT false,
  rule_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_id, snapshot_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_delinquency_snapshots TO authenticated;
GRANT ALL ON public.loan_delinquency_snapshots TO service_role;
ALTER TABLE public.loan_delinquency_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_delinquency_snapshots_staff ON public.loan_delinquency_snapshots FOR ALL TO authenticated
  USING (has_permission(cooperative_id, 'collections.view', auth.uid()) OR has_permission(cooperative_id, 'loans.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_permission(cooperative_id, 'collections.manage', auth.uid()) OR has_permission(cooperative_id, 'loans.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()));

-- ============ PENALTY WAIVERS ============
CREATE TABLE public.loan_penalty_waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  status public.loan_request_status NOT NULL DEFAULT 'REQUESTED',
  requested_by uuid,
  reviewed_by uuid,
  approved_by uuid,
  posted_transaction_id uuid REFERENCES public.loan_transactions(id) ON DELETE SET NULL,
  decision_notes text,
  effective_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_penalty_waivers TO authenticated;
GRANT ALL ON public.loan_penalty_waivers TO service_role;
ALTER TABLE public.loan_penalty_waivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_penalty_waivers_staff ON public.loan_penalty_waivers FOR ALL TO authenticated
  USING (has_permission(cooperative_id, 'repayments.view', auth.uid()) OR has_permission(cooperative_id, 'loans.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_permission(cooperative_id, 'repayments.waive_penalty', auth.uid()) OR has_permission(cooperative_id, 'repayments.create', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()));

-- ============ COLLECTIONS ============
CREATE TABLE public.collection_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  case_number text NOT NULL,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  delinquency_stage text,
  priority public.collection_priority NOT NULL DEFAULT 'MEDIUM',
  assigned_officer uuid,
  opened_date date NOT NULL DEFAULT CURRENT_DATE,
  closed_date date,
  status public.collection_case_status NOT NULL DEFAULT 'OPEN',
  days_past_due integer NOT NULL DEFAULT 0,
  arrears_amount numeric NOT NULL DEFAULT 0,
  outstanding_amount numeric NOT NULL DEFAULT 0,
  last_action_date date,
  next_action_date date,
  next_action text,
  resolution text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (cooperative_id, case_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_cases TO authenticated;
GRANT ALL ON public.collection_cases TO service_role;
ALTER TABLE public.collection_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY collection_cases_staff ON public.collection_cases FOR ALL TO authenticated
  USING (has_permission(cooperative_id, 'collections.view', auth.uid()) OR has_permission(cooperative_id, 'loans.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_permission(cooperative_id, 'collections.manage', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()));
CREATE POLICY collection_cases_member_read ON public.collection_cases FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = collection_cases.member_id AND m.user_id = auth.uid()));

CREATE TABLE public.collection_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.collection_cases(id) ON DELETE CASCADE,
  action_type public.collection_action_type NOT NULL,
  action_date date NOT NULL DEFAULT CURRENT_DATE,
  officer uuid,
  outcome text,
  next_action text,
  next_action_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_actions TO authenticated;
GRANT ALL ON public.collection_actions TO service_role;
ALTER TABLE public.collection_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY collection_actions_staff ON public.collection_actions FOR ALL TO authenticated
  USING (has_permission(cooperative_id, 'collections.view', auth.uid()) OR has_permission(cooperative_id, 'loans.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_permission(cooperative_id, 'collections.manage', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()));

CREATE TABLE public.promise_to_pay (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.collection_cases(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  promised_date date NOT NULL,
  status public.promise_status NOT NULL DEFAULT 'PENDING',
  fulfilled_amount numeric NOT NULL DEFAULT 0,
  variance_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promise_to_pay TO authenticated;
GRANT ALL ON public.promise_to_pay TO service_role;
ALTER TABLE public.promise_to_pay ENABLE ROW LEVEL SECURITY;
CREATE POLICY promise_to_pay_staff ON public.promise_to_pay FOR ALL TO authenticated
  USING (has_permission(cooperative_id, 'collections.view', auth.uid()) OR has_permission(cooperative_id, 'loans.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_permission(cooperative_id, 'collections.manage', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()));
CREATE POLICY promise_to_pay_member_read ON public.promise_to_pay FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = promise_to_pay.member_id AND m.user_id = auth.uid()));

-- ============ SETTLEMENT, RESTRUCTURE, WRITE-OFF ============
CREATE TABLE public.loan_settlement_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  quote_number text,
  requested_by uuid,
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  settlement_date date,
  outstanding_principal numeric NOT NULL DEFAULT 0,
  accrued_interest numeric NOT NULL DEFAULT 0,
  outstanding_fees numeric NOT NULL DEFAULT 0,
  outstanding_penalties numeric NOT NULL DEFAULT 0,
  gross_interest_refund numeric NOT NULL DEFAULT 0,
  applicable_charges numeric NOT NULL DEFAULT 0,
  net_interest_refund numeric NOT NULL DEFAULT 0,
  settlement_amount numeric NOT NULL DEFAULT 0,
  expiry_date date,
  policy_basis text,
  status public.loan_request_status NOT NULL DEFAULT 'REQUESTED',
  decision_notes text,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_settlement_quotes TO authenticated;
GRANT ALL ON public.loan_settlement_quotes TO service_role;
ALTER TABLE public.loan_settlement_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_settlement_quotes_staff ON public.loan_settlement_quotes FOR ALL TO authenticated
  USING (has_permission(cooperative_id, 'repayments.view', auth.uid()) OR has_permission(cooperative_id, 'loans.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_permission(cooperative_id, 'repayments.settle', auth.uid()) OR has_permission(cooperative_id, 'repayments.create', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()));
CREATE POLICY loan_settlement_quotes_member_read ON public.loan_settlement_quotes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = loan_settlement_quotes.member_id AND m.user_id = auth.uid()));
CREATE POLICY loan_settlement_quotes_member_request ON public.loan_settlement_quotes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.members m WHERE m.id = loan_settlement_quotes.member_id AND m.user_id = auth.uid()));

CREATE TABLE public.loan_restructures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  restructure_type text NOT NULL DEFAULT 'TENURE_EXTENSION',
  reason text,
  assessment text,
  old_terms jsonb,
  new_terms jsonb,
  new_tenure integer,
  new_frequency public.contribution_frequency,
  new_interest_rate numeric,
  capitalise_arrears boolean NOT NULL DEFAULT false,
  effective_date date,
  new_schedule_id uuid REFERENCES public.loan_schedules(id) ON DELETE SET NULL,
  status public.loan_request_status NOT NULL DEFAULT 'REQUESTED',
  decision_notes text,
  requested_by uuid,
  checked_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_restructures TO authenticated;
GRANT ALL ON public.loan_restructures TO service_role;
ALTER TABLE public.loan_restructures ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_restructures_staff ON public.loan_restructures FOR ALL TO authenticated
  USING (has_permission(cooperative_id, 'repayments.view', auth.uid()) OR has_permission(cooperative_id, 'loans.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_permission(cooperative_id, 'repayments.restructure', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()));
CREATE POLICY loan_restructures_member_read ON public.loan_restructures FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = loan_restructures.member_id AND m.user_id = auth.uid()));

CREATE TABLE public.loan_write_offs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  principal_component numeric NOT NULL DEFAULT 0,
  interest_component numeric NOT NULL DEFAULT 0,
  fee_component numeric NOT NULL DEFAULT 0,
  penalty_component numeric NOT NULL DEFAULT 0,
  reason text NOT NULL,
  recovery_assessment text,
  supporting_document_id uuid REFERENCES public.member_documents(id) ON DELETE SET NULL,
  status public.loan_request_status NOT NULL DEFAULT 'REQUESTED',
  effective_date date,
  posted_transaction_id uuid REFERENCES public.loan_transactions(id) ON DELETE SET NULL,
  recovered_amount numeric NOT NULL DEFAULT 0,
  decision_notes text,
  requested_by uuid,
  reviewed_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_write_offs TO authenticated;
GRANT ALL ON public.loan_write_offs TO service_role;
ALTER TABLE public.loan_write_offs ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_write_offs_staff ON public.loan_write_offs FOR ALL TO authenticated
  USING (has_permission(cooperative_id, 'repayments.view', auth.uid()) OR has_permission(cooperative_id, 'loans.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_permission(cooperative_id, 'repayments.write_off', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()));

-- ============ IMMUTABILITY ============
CREATE OR REPLACE FUNCTION public.enforce_loan_repayment_immutability()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('POSTED','REVERSED') THEN
      RAISE EXCEPTION 'Posted repayments cannot be deleted. Record a reversal instead.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'POSTED' THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.loan_id IS DISTINCT FROM OLD.loan_id
       OR NEW.member_id IS DISTINCT FROM OLD.member_id
       OR NEW.repayment_date IS DISTINCT FROM OLD.repayment_date
       OR NEW.payment_source IS DISTINCT FROM OLD.payment_source THEN
      RAISE EXCEPTION 'Posted repayments cannot be edited. Record a reversal instead.';
    END IF;
  END IF;
  IF OLD.status = 'REVERSED' AND NEW.status = 'REVERSED' AND NEW.reversal_reason IS DISTINCT FROM OLD.reversal_reason THEN
    RAISE EXCEPTION 'A reversed repayment cannot be changed again.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_loan_repayment_immutability() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER loan_repayments_immutable BEFORE UPDATE OR DELETE ON public.loan_repayments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_loan_repayment_immutability();

CREATE OR REPLACE FUNCTION public.protect_posted_repayment_allocations()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_status public.loan_repayment_status;
BEGIN
  SELECT status INTO v_status FROM public.loan_repayments WHERE id = COALESCE(NEW.repayment_id, OLD.repayment_id);
  IF v_status = 'POSTED' AND TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Allocations of a posted repayment cannot be changed. Record a reversal instead.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_posted_repayment_allocations() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER loan_repayment_allocations_immutable BEFORE UPDATE OR DELETE ON public.loan_repayment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.protect_posted_repayment_allocations();

-- ============ NUMBERING ============
CREATE OR REPLACE FUNCTION public.next_loan_repayment_number(_cooperative_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  SELECT COUNT(*) + 1 INTO n FROM public.loan_repayments WHERE cooperative_id = _cooperative_id;
  RETURN 'RP-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_loan_repayment_number(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.next_collection_case_number(_cooperative_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  SELECT COUNT(*) + 1 INTO n FROM public.collection_cases WHERE cooperative_id = _cooperative_id;
  RETURN 'CC-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_collection_case_number(uuid) FROM PUBLIC, anon;

-- ============ TRIGGERS: updated_at + audit ============
CREATE TRIGGER loan_repayments_updated_at BEFORE UPDATE ON public.loan_repayments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER unapplied_loan_payments_updated_at BEFORE UPDATE ON public.unapplied_loan_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER loan_penalty_waivers_updated_at BEFORE UPDATE ON public.loan_penalty_waivers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER collection_cases_updated_at BEFORE UPDATE ON public.collection_cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER promise_to_pay_updated_at BEFORE UPDATE ON public.promise_to_pay FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER loan_settlement_quotes_updated_at BEFORE UPDATE ON public.loan_settlement_quotes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER loan_restructures_updated_at BEFORE UPDATE ON public.loan_restructures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER loan_write_offs_updated_at BEFORE UPDATE ON public.loan_write_offs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER loan_repayments_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_repayments FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER loan_repayment_allocations_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_repayment_allocations FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER loan_penalty_waivers_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_penalty_waivers FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER collection_cases_audit AFTER INSERT OR UPDATE OR DELETE ON public.collection_cases FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER collection_actions_audit AFTER INSERT OR UPDATE OR DELETE ON public.collection_actions FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER promise_to_pay_audit AFTER INSERT OR UPDATE OR DELETE ON public.promise_to_pay FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER loan_settlement_quotes_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_settlement_quotes FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER loan_restructures_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_restructures FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER loan_write_offs_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_write_offs FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ============ PERMISSIONS ============
INSERT INTO public.permissions (code, module, resource, action, description) VALUES
  ('repayments.view','repayments','repayments','view','View loan repayments and allocations'),
  ('repayments.create','repayments','repayments','create','Record loan repayments'),
  ('repayments.check','repayments','repayments','check','Verify loan repayments'),
  ('repayments.approve','repayments','repayments','approve','Approve loan repayments'),
  ('repayments.post','repayments','repayments','post','Post loan repayments to the loan ledger'),
  ('repayments.reverse','repayments','repayments','reverse','Reverse posted loan repayments'),
  ('repayments.waive_penalty','repayments','penalties','waive','Approve penalty waivers'),
  ('repayments.restructure','repayments','restructures','manage','Request and approve loan restructures'),
  ('repayments.write_off','repayments','write_offs','manage','Request and approve loan write-offs'),
  ('repayments.settle','repayments','settlements','manage','Prepare and approve early settlements'),
  ('repayments.export','repayments','reports','export','Export repayment and collection reports'),
  ('collections.view','collections','cases','view','View collection cases and delinquency'),
  ('collections.manage','collections','cases','manage','Manage collection cases, actions and promises')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'repayments.view','repayments.create','repayments.check','repayments.approve','repayments.post',
  'repayments.reverse','repayments.waive_penalty','repayments.restructure','repayments.write_off',
  'repayments.settle','repayments.export','collections.view','collections.manage')
WHERE (
  (r.key IN ('COOPERATIVE_ADMIN','COOPERATIVE_MANAGER'))
  OR (r.key = 'LOAN_OFFICER' AND p.code IN ('repayments.view','repayments.create','repayments.export','collections.view','collections.manage'))
  OR (r.key = 'ACCOUNTANT' AND p.code IN ('repayments.view','repayments.create','repayments.post','repayments.export','collections.view'))
  OR (r.key = 'TREASURER' AND p.code IN ('repayments.view','repayments.approve','repayments.settle','repayments.export','collections.view'))
  OR (r.key = 'CHECKER' AND p.code IN ('repayments.view','repayments.check','collections.view'))
  OR (r.key = 'APPROVER' AND p.code IN ('repayments.view','repayments.approve','repayments.waive_penalty','repayments.restructure','repayments.write_off','repayments.settle','collections.view'))
  OR (r.key = 'AUDITOR' AND p.code IN ('repayments.view','repayments.export','collections.view'))
)
ON CONFLICT DO NOTHING;
