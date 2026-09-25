-- ENUMS
CREATE TYPE public.withdrawal_status AS ENUM ('DRAFT','SUBMITTED','ELIGIBILITY_CHECK','UNDER_REVIEW','CHECKED','APPROVED','PAYMENT_PENDING','PROCESSING','COMPLETED','REJECTED','CANCELLED','FAILED','REVERSED','EXPIRED');
CREATE TYPE public.withdrawal_eligibility_status AS ENUM ('NOT_CHECKED','ELIGIBLE','PARTIALLY_ELIGIBLE','NOT_ELIGIBLE');
CREATE TYPE public.withdrawal_hold_status AS ENUM ('ACTIVE','RELEASED','CONSUMED','EXPIRED','CANCELLED');
CREATE TYPE public.withdrawal_payout_status AS ENUM ('PENDING','SUBMITTED','PROCESSING','SUCCESSFUL','FAILED','RETRYING','REVERSED','CANCELLED');
CREATE TYPE public.withdrawal_exception_status AS ENUM ('OPEN','IN_REVIEW','RESOLVED','DISMISSED');
CREATE TYPE public.exit_settlement_status AS ENUM ('REQUESTED','NOTICE_CHECK','CALCULATED','UNDER_REVIEW','CHECKED','APPROVED','SETTLED','REJECTED','CANCELLED');
CREATE TYPE public.withdrawal_frequency_period AS ENUM ('CALENDAR_YEAR','ROLLING_YEAR','CALENDAR_MONTH','QUARTER','ROLLING_DAYS');

-- WITHDRAWAL TYPES
CREATE TABLE public.withdrawal_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  eligible_savings_products uuid[] NOT NULL DEFAULT '{}',
  eligible_product_types text[] NOT NULL DEFAULT '{}',
  minimum_membership_months integer NOT NULL DEFAULT 0,
  minimum_savings_months integer NOT NULL DEFAULT 0,
  maximum_percentage numeric(7,4),
  maximum_amount numeric(18,2),
  minimum_amount numeric(18,2) NOT NULL DEFAULT 0,
  minimum_balance_after numeric(18,2) NOT NULL DEFAULT 0,
  frequency_limit integer,
  frequency_period public.withdrawal_frequency_period NOT NULL DEFAULT 'CALENDAR_YEAR',
  frequency_rolling_days integer,
  cooling_period_days integer NOT NULL DEFAULT 0,
  requires_no_active_loan boolean NOT NULL DEFAULT false,
  requires_no_delinquency boolean NOT NULL DEFAULT true,
  requires_purpose boolean NOT NULL DEFAULT false,
  requires_document boolean NOT NULL DEFAULT false,
  requires_approval boolean NOT NULL DEFAULT true,
  approval_level text,
  allowed_member_statuses text[] NOT NULL DEFAULT '{}',
  allowed_member_categories uuid[] NOT NULL DEFAULT '{}',
  fee_type public.loan_fee_type NOT NULL DEFAULT 'NONE',
  fee_value numeric(18,4) NOT NULL DEFAULT 0,
  rules_configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (cooperative_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdrawal_types TO authenticated;
GRANT ALL ON public.withdrawal_types TO service_role;
ALTER TABLE public.withdrawal_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY wt_read ON public.withdrawal_types FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.has_permission(cooperative_id,'withdrawals.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY wt_write ON public.withdrawal_types FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id,'withdrawals.manage_types',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id,'withdrawals.manage_types',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

-- WITHDRAWAL REQUESTS
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  withdrawal_number text NOT NULL,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  withdrawal_type_id uuid NOT NULL REFERENCES public.withdrawal_types(id),
  savings_account_id uuid REFERENCES public.member_savings_accounts(id),
  savings_product_id uuid REFERENCES public.savings_products(id),
  requested_amount numeric(18,2) NOT NULL CHECK (requested_amount > 0),
  eligible_amount numeric(18,2) NOT NULL DEFAULT 0,
  approved_amount numeric(18,2),
  fee_amount numeric(18,2) NOT NULL DEFAULT 0,
  net_payout_amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  requested_payment_date date,
  purpose text,
  destination_bank_account_id uuid REFERENCES public.member_bank_accounts(id),
  document_id uuid REFERENCES public.member_documents(id),
  status public.withdrawal_status NOT NULL DEFAULT 'DRAFT',
  eligibility_status public.withdrawal_eligibility_status NOT NULL DEFAULT 'NOT_CHECKED',
  eligibility_snapshot jsonb,
  savings_transaction_id uuid REFERENCES public.savings_transactions(id),
  reversal_of uuid REFERENCES public.withdrawal_requests(id),
  reversal_reason text,
  rejection_reason text,
  cancellation_reason text,
  notes text,
  submitted_at timestamptz,
  checked_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  processed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  reversed_at timestamptz,
  created_by uuid,
  checked_by uuid,
  approved_by uuid,
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cooperative_id, withdrawal_number)
);
CREATE INDEX idx_wr_coop ON public.withdrawal_requests(cooperative_id);
CREATE INDEX idx_wr_member ON public.withdrawal_requests(member_id);
CREATE INDEX idx_wr_status ON public.withdrawal_requests(cooperative_id, status);
CREATE INDEX idx_wr_date ON public.withdrawal_requests(cooperative_id, request_date);
GRANT SELECT, INSERT, UPDATE ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY wr_read ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = withdrawal_requests.member_id AND m.user_id = auth.uid())
    OR public.has_permission(cooperative_id,'withdrawals.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY wr_insert ON public.withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.members m WHERE m.id = withdrawal_requests.member_id AND m.user_id = auth.uid())
    OR public.has_permission(cooperative_id,'withdrawals.create',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY wr_update ON public.withdrawal_requests FOR UPDATE TO authenticated
  USING (public.has_permission(cooperative_id,'withdrawals.create',auth.uid()) OR public.has_permission(cooperative_id,'withdrawals.check',auth.uid())
    OR public.has_permission(cooperative_id,'withdrawals.approve',auth.uid()) OR public.has_permission(cooperative_id,'withdrawals.process',auth.uid())
    OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

-- ELIGIBILITY CHECKS
CREATE TABLE public.withdrawal_eligibility_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  withdrawal_request_id uuid REFERENCES public.withdrawal_requests(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  withdrawal_type_id uuid NOT NULL REFERENCES public.withdrawal_types(id),
  savings_balance numeric(18,2) NOT NULL DEFAULT 0,
  restricted_balance numeric(18,2) NOT NULL DEFAULT 0,
  pledged_balance numeric(18,2) NOT NULL DEFAULT 0,
  reserved_balance numeric(18,2) NOT NULL DEFAULT 0,
  available_balance numeric(18,2) NOT NULL DEFAULT 0,
  outstanding_loan_balance numeric(18,2) NOT NULL DEFAULT 0,
  overdue_amount numeric(18,2) NOT NULL DEFAULT 0,
  membership_tenure_months integer NOT NULL DEFAULT 0,
  savings_tenure_months integer NOT NULL DEFAULT 0,
  last_withdrawal_date date,
  withdrawals_in_period integer NOT NULL DEFAULT 0,
  maximum_allowed numeric(18,2) NOT NULL DEFAULT 0,
  calculated_eligible_amount numeric(18,2) NOT NULL DEFAULT 0,
  eligibility_status public.withdrawal_eligibility_status NOT NULL DEFAULT 'NOT_CHECKED',
  failure_reasons text[] NOT NULL DEFAULT '{}',
  rule_snapshot jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  calculated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wec_request ON public.withdrawal_eligibility_checks(withdrawal_request_id);
CREATE INDEX idx_wec_member ON public.withdrawal_eligibility_checks(member_id);
GRANT SELECT, INSERT ON public.withdrawal_eligibility_checks TO authenticated;
GRANT ALL ON public.withdrawal_eligibility_checks TO service_role;
ALTER TABLE public.withdrawal_eligibility_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY wec_read ON public.withdrawal_eligibility_checks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = withdrawal_eligibility_checks.member_id AND m.user_id = auth.uid())
    OR public.has_permission(cooperative_id,'withdrawals.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY wec_insert ON public.withdrawal_eligibility_checks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.members m WHERE m.id = withdrawal_eligibility_checks.member_id AND m.user_id = auth.uid())
    OR public.has_permission(cooperative_id,'withdrawals.create',auth.uid()) OR public.has_permission(cooperative_id,'withdrawals.view',auth.uid())
    OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

-- HOLDS
CREATE TABLE public.withdrawal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  withdrawal_request_id uuid REFERENCES public.withdrawal_requests(id) ON DELETE CASCADE,
  savings_account_id uuid REFERENCES public.member_savings_accounts(id),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  hold_type text NOT NULL DEFAULT 'WITHDRAWAL_REQUEST',
  status public.withdrawal_hold_status NOT NULL DEFAULT 'ACTIVE',
  reason text,
  expires_at timestamptz,
  released_at timestamptz,
  released_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wh_member ON public.withdrawal_holds(member_id, status);
GRANT SELECT, INSERT, UPDATE ON public.withdrawal_holds TO authenticated;
GRANT ALL ON public.withdrawal_holds TO service_role;
ALTER TABLE public.withdrawal_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY wh_read ON public.withdrawal_holds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = withdrawal_holds.member_id AND m.user_id = auth.uid())
    OR public.has_permission(cooperative_id,'withdrawals.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY wh_insert ON public.withdrawal_holds FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.members m WHERE m.id = withdrawal_holds.member_id AND m.user_id = auth.uid())
    OR public.has_permission(cooperative_id,'withdrawals.create',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY wh_update ON public.withdrawal_holds FOR UPDATE TO authenticated
  USING (public.has_permission(cooperative_id,'withdrawals.create',auth.uid()) OR public.has_permission(cooperative_id,'withdrawals.approve',auth.uid())
    OR public.has_permission(cooperative_id,'withdrawals.process',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

-- PAYOUTS
CREATE TABLE public.withdrawal_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  withdrawal_request_id uuid NOT NULL REFERENCES public.withdrawal_requests(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.member_bank_accounts(id),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  payment_reference text,
  payment_provider text,
  bank_reference text,
  status public.withdrawal_payout_status NOT NULL DEFAULT 'PENDING',
  failure_reason text,
  retry_count integer NOT NULL DEFAULT 0,
  initiated_at timestamptz,
  processed_at timestamptz,
  notes text,
  created_by uuid,
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wp_request ON public.withdrawal_payouts(withdrawal_request_id);
GRANT SELECT, INSERT, UPDATE ON public.withdrawal_payouts TO authenticated;
GRANT ALL ON public.withdrawal_payouts TO service_role;
ALTER TABLE public.withdrawal_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY wp_read ON public.withdrawal_payouts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = withdrawal_payouts.member_id AND m.user_id = auth.uid())
    OR public.has_permission(cooperative_id,'withdrawals.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY wp_write ON public.withdrawal_payouts FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id,'withdrawals.process',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id,'withdrawals.process',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

-- EXCEPTIONS
CREATE TABLE public.withdrawal_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  withdrawal_request_id uuid REFERENCES public.withdrawal_requests(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  severity public.checkoff_exception_severity NOT NULL DEFAULT 'MEDIUM',
  exception_type text NOT NULL,
  detail text,
  status public.withdrawal_exception_status NOT NULL DEFAULT 'OPEN',
  assigned_to uuid,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.withdrawal_exceptions TO authenticated;
GRANT ALL ON public.withdrawal_exceptions TO service_role;
ALTER TABLE public.withdrawal_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY wx_read ON public.withdrawal_exceptions FOR SELECT TO authenticated
  USING (public.has_permission(cooperative_id,'withdrawals.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY wx_write ON public.withdrawal_exceptions FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id,'withdrawals.create',auth.uid()) OR public.has_permission(cooperative_id,'withdrawals.check',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id,'withdrawals.create',auth.uid()) OR public.has_permission(cooperative_id,'withdrawals.check',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

-- EXIT SETTLEMENTS
CREATE TABLE public.exit_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  settlement_number text NOT NULL,
  exit_reason text,
  exit_type text NOT NULL DEFAULT 'RESIGNATION',
  notice_date date,
  notice_required_days integer NOT NULL DEFAULT 0,
  notice_satisfied boolean NOT NULL DEFAULT false,
  effective_date date,
  regular_savings numeric(18,2) NOT NULL DEFAULT 0,
  special_savings numeric(18,2) NOT NULL DEFAULT 0,
  other_balances numeric(18,2) NOT NULL DEFAULT 0,
  outstanding_loan_principal numeric(18,2) NOT NULL DEFAULT 0,
  outstanding_interest numeric(18,2) NOT NULL DEFAULT 0,
  outstanding_fees numeric(18,2) NOT NULL DEFAULT 0,
  outstanding_penalties numeric(18,2) NOT NULL DEFAULT 0,
  other_obligations numeric(18,2) NOT NULL DEFAULT 0,
  exit_fee numeric(18,2) NOT NULL DEFAULT 0,
  gross_entitlement numeric(18,2) NOT NULL DEFAULT 0,
  net_settlement numeric(18,2) NOT NULL DEFAULT 0,
  offset_applied boolean NOT NULL DEFAULT false,
  calculation_snapshot jsonb,
  status public.exit_settlement_status NOT NULL DEFAULT 'REQUESTED',
  withdrawal_request_id uuid REFERENCES public.withdrawal_requests(id),
  decision_notes text,
  requested_by uuid,
  checked_by uuid,
  approved_by uuid,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cooperative_id, settlement_number)
);
GRANT SELECT, INSERT, UPDATE ON public.exit_settlements TO authenticated;
GRANT ALL ON public.exit_settlements TO service_role;
ALTER TABLE public.exit_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY es_read ON public.exit_settlements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = exit_settlements.member_id AND m.user_id = auth.uid())
    OR public.has_permission(cooperative_id,'withdrawals.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY es_write ON public.exit_settlements FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id,'withdrawals.exit_settle',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id,'withdrawals.exit_settle',auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));

-- UPDATED_AT TRIGGERS
CREATE TRIGGER trg_wt_updated BEFORE UPDATE ON public.withdrawal_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wr_updated BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wec_updated BEFORE UPDATE ON public.withdrawal_eligibility_checks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wh_updated BEFORE UPDATE ON public.withdrawal_holds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wp_updated BEFORE UPDATE ON public.withdrawal_payouts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wx_updated BEFORE UPDATE ON public.withdrawal_exceptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_es_updated BEFORE UPDATE ON public.exit_settlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUDIT TRIGGERS
CREATE TRIGGER trg_wt_audit AFTER INSERT OR UPDATE OR DELETE ON public.withdrawal_types FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_wr_audit AFTER INSERT OR UPDATE OR DELETE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_wh_audit AFTER INSERT OR UPDATE OR DELETE ON public.withdrawal_holds FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_wp_audit AFTER INSERT OR UPDATE OR DELETE ON public.withdrawal_payouts FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_es_audit AFTER INSERT OR UPDATE OR DELETE ON public.exit_settlements FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- IMMUTABILITY: completed/reversed withdrawals cannot be edited except reversal bookkeeping
CREATE OR REPLACE FUNCTION public.enforce_withdrawal_immutability()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('COMPLETED','REVERSED') THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'COMPLETED' AND NEW.status = 'REVERSED') THEN
      RAISE EXCEPTION 'A completed withdrawal cannot change status except by reversal';
    END IF;
    IF NEW.requested_amount <> OLD.requested_amount
       OR COALESCE(NEW.approved_amount,-1) <> COALESCE(OLD.approved_amount,-1)
       OR NEW.net_payout_amount <> OLD.net_payout_amount
       OR NEW.member_id <> OLD.member_id THEN
      RAISE EXCEPTION 'A completed withdrawal cannot be edited; post a reversal instead';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_wr_immutable BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_withdrawal_immutability();

-- NUMBERING
CREATE OR REPLACE FUNCTION public.next_withdrawal_number(_cooperative_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  SELECT count(*) + 1 INTO n FROM public.withdrawal_requests WHERE cooperative_id = _cooperative_id;
  RETURN 'WD-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.next_withdrawal_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_withdrawal_number(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.next_exit_settlement_number(_cooperative_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  SELECT count(*) + 1 INTO n FROM public.exit_settlements WHERE cooperative_id = _cooperative_id;
  RETURN 'EX-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.next_exit_settlement_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_exit_settlement_number(uuid) TO authenticated, service_role;

-- PERMISSIONS
INSERT INTO public.permissions (code, module, resource, action, description)
VALUES
  ('withdrawals.check','withdrawals','withdrawals','check','Review withdrawal requests'),
  ('withdrawals.process','withdrawals','payouts','process','Initiate, retry and record withdrawal payouts'),
  ('withdrawals.reverse','withdrawals','withdrawals','reverse','Reverse completed withdrawals'),
  ('withdrawals.manage_types','withdrawals','withdrawal_types','manage','Configure withdrawal types and rules'),
  ('withdrawals.exit_settle','withdrawals','exit_settlements','manage','Prepare and approve membership exit settlements'),
  ('withdrawals.export','withdrawals','withdrawals','export','Export withdrawal reports')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = ANY (ARRAY[
  'withdrawals.view','withdrawals.create','withdrawals.check','withdrawals.approve',
  'withdrawals.process','withdrawals.reverse','withdrawals.manage_types','withdrawals.exit_settle','withdrawals.export'])
WHERE r.key IN ('COOPERATIVE_ADMIN','COOPERATIVE_MANAGER','TREASURER','ACCOUNTANT','CHECKER','APPROVER','AUDITOR')
ON CONFLICT DO NOTHING;

-- SAMPLE WITHDRAWAL TYPES (editable defaults per cooperative)
INSERT INTO public.withdrawal_types (
  cooperative_id, code, name, description, eligible_product_types, minimum_membership_months, minimum_savings_months,
  maximum_percentage, frequency_limit, frequency_period, frequency_rolling_days, cooling_period_days,
  requires_no_active_loan, requires_purpose, requires_document, requires_approval, allowed_member_statuses)
SELECT c.id, v.code, v.name, v.description, v.product_types, v.mm, v.ms, v.pct, v.flimit, v.fperiod::public.withdrawal_frequency_period, v.rolling, v.cooling,
       v.no_loan, v.purpose, v.document, true, v.statuses
FROM public.cooperatives c
CROSS JOIN (VALUES
  ('GENERAL_SAVINGS','General savings withdrawal','Sample rule: up to 50% of eligible regular savings, no running loan, 6 months continuous savings, once every 90 days.', ARRAY['ORDINARY'], 6, 6, 0.5, 1, 'ROLLING_DAYS', 90, 0, true, false, false, ARRAY['ACTIVE']),
  ('SPECIAL_SAVINGS','Special savings withdrawal','Sample rule: up to 50% of eligible special savings, interest free, no outstanding loan, 6 months tenure, 4 times a year.', ARRAY['SPECIAL'], 6, 6, 0.5, 4, 'CALENDAR_YEAR', NULL, 0, true, true, false, ARRAY['ACTIVE']),
  ('EMERGENCY_WITHDRAWAL','Emergency withdrawal','Sample rule: committee assessed emergency withdrawal, purpose and supporting document required.', ARRAY['ORDINARY','SPECIAL'], 3, 3, 0.5, 1, 'CALENDAR_YEAR', NULL, 0, false, true, true, ARRAY['ACTIVE']),
  ('MEMBERSHIP_EXIT','Membership exit settlement','Sample rule: full settlement on exit after obligations are cleared.', ARRAY['ORDINARY','SPECIAL','INVESTMENT','OTHER'], 0, 0, 1.0, NULL, 'CALENDAR_YEAR', NULL, 0, false, true, true, ARRAY['ACTIVE','EXIT_PENDING','RETIRED']),
  ('RETIREMENT_SETTLEMENT','Retirement settlement','Sample rule: full settlement on retirement after obligations are cleared.', ARRAY['ORDINARY','SPECIAL','INVESTMENT','OTHER'], 0, 0, 1.0, NULL, 'CALENDAR_YEAR', NULL, 0, false, true, true, ARRAY['ACTIVE','RETIRED','EXIT_PENDING']),
  ('DECEASED_MEMBER_SETTLEMENT','Deceased member settlement','Sample rule: settlement to the documented next of kin or estate, documentation required.', ARRAY['ORDINARY','SPECIAL','INVESTMENT','OTHER'], 0, 0, 1.0, NULL, 'CALENDAR_YEAR', NULL, 0, false, true, true, ARRAY['DECEASED'])
) AS v(code,name,description,product_types,mm,ms,pct,flimit,fperiod,rolling,cooling,no_loan,purpose,document,statuses)
ON CONFLICT (cooperative_id, code) DO NOTHING;