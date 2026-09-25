
-- ========== ENUMS ==========
CREATE TYPE public.loan_interest_method AS ENUM ('FLAT','REDUCING_BALANCE','AMORTISED','SIMPLE','CUSTOM');
CREATE TYPE public.loan_tenure_unit AS ENUM ('DAYS','WEEKS','MONTHS','YEARS');
CREATE TYPE public.loan_fee_type AS ENUM ('NONE','FLAT','PERCENTAGE');
CREATE TYPE public.loan_application_status AS ENUM ('DRAFT','SUBMITTED','ELIGIBILITY_CHECK','UNDER_REVIEW','GUARANTOR_PENDING','CREDIT_REVIEW','CHECKED','APPROVED','DISBURSEMENT_PENDING','DISBURSED','ACTIVE','CLOSED','REJECTED','DECLINED','WITHDRAWN','CANCELLED','DEFAULTED','RESTRUCTURED','WRITTEN_OFF');
CREATE TYPE public.loan_eligibility_status AS ENUM ('NOT_CHECKED','ELIGIBLE','CONDITIONAL','NOT_ELIGIBLE');
CREATE TYPE public.loan_guarantor_status AS ENUM ('PENDING','ACCEPTED','DECLINED','RELEASED','CANCELLED');
CREATE TYPE public.loan_security_type AS ENUM ('SAVINGS','SELF_GUARANTEE','GUARANTOR','PDC','STANDING_INSTRUCTION','INSURANCE','ASSET','PROPERTY','INVESTMENT','OTHER');
CREATE TYPE public.loan_security_status AS ENUM ('PROPOSED','VERIFIED','REJECTED','RELEASED');
CREATE TYPE public.loan_risk_rating AS ENUM ('LOW','MODERATE','HIGH','CRITICAL');
CREATE TYPE public.loan_assessment_status AS ENUM ('DRAFT','COMPLETED');
CREATE TYPE public.loan_account_status AS ENUM ('PENDING_DISBURSEMENT','ACTIVE','CLOSED','DEFAULTED','RESTRUCTURED','WRITTEN_OFF','CANCELLED');
CREATE TYPE public.loan_transaction_type AS ENUM ('DISBURSEMENT','PRINCIPAL_REPAYMENT','INTEREST_ACCRUAL','INTEREST_REPAYMENT','FEE_CHARGE','FEE_REPAYMENT','PENALTY_CHARGE','PENALTY_REPAYMENT','ADJUSTMENT_DEBIT','ADJUSTMENT_CREDIT','REVERSAL','WRITE_OFF','RESTRUCTURE_ADJUSTMENT');
CREATE TYPE public.loan_transaction_status AS ENUM ('DRAFT','POSTED','REVERSED');

-- ========== LOAN PRODUCTS ==========
CREATE TABLE public.loan_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  product_code text NOT NULL,
  product_name text NOT NULL,
  description text,
  loan_category text,
  status text NOT NULL DEFAULT 'ACTIVE',
  currency text NOT NULL DEFAULT 'NGN',
  minimum_amount numeric(18,2) NOT NULL DEFAULT 0,
  maximum_amount numeric(18,2),
  minimum_tenure integer NOT NULL DEFAULT 1,
  maximum_tenure integer NOT NULL DEFAULT 12,
  tenure_unit public.loan_tenure_unit NOT NULL DEFAULT 'MONTHS',
  repayment_frequency public.contribution_frequency NOT NULL DEFAULT 'MONTHLY',
  interest_method public.loan_interest_method NOT NULL DEFAULT 'FLAT',
  interest_rate numeric(9,4) NOT NULL DEFAULT 0,
  interest_rate_type text NOT NULL DEFAULT 'PER_ANNUM',
  processing_fee_type public.loan_fee_type NOT NULL DEFAULT 'NONE',
  processing_fee_value numeric(18,4) NOT NULL DEFAULT 0,
  penal_interest_rate numeric(9,4) NOT NULL DEFAULT 0,
  early_repayment_policy text,
  grace_period integer NOT NULL DEFAULT 0,
  minimum_membership_months integer NOT NULL DEFAULT 0,
  minimum_savings_months integer NOT NULL DEFAULT 0,
  savings_multiplier numeric(9,2),
  special_savings_waiting_period integer NOT NULL DEFAULT 0,
  maximum_debt_to_income_ratio numeric(6,2),
  maximum_installment_to_income_ratio numeric(6,2),
  guarantor_required boolean NOT NULL DEFAULT false,
  minimum_guarantors integer NOT NULL DEFAULT 0,
  maximum_guarantors integer NOT NULL DEFAULT 0,
  collateral_required boolean NOT NULL DEFAULT false,
  self_guarantee_allowed boolean NOT NULL DEFAULT true,
  pdc_required boolean NOT NULL DEFAULT false,
  standing_instruction_required boolean NOT NULL DEFAULT false,
  insurance_required boolean NOT NULL DEFAULT false,
  requires_credit_assessment boolean NOT NULL DEFAULT true,
  requires_committee_approval boolean NOT NULL DEFAULT false,
  requires_management_approval boolean NOT NULL DEFAULT false,
  is_sample boolean NOT NULL DEFAULT false,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (cooperative_id, product_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_products TO authenticated;
GRANT ALL ON public.loan_products TO service_role;
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_products_read" ON public.loan_products FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "loan_products_write" ON public.loan_products FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'loans.configure', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'loans.configure', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));
CREATE TRIGGER loan_products_updated_at BEFORE UPDATE ON public.loan_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER loan_products_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_products FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ========== LOAN PURPOSES ==========
CREATE TABLE public.loan_purposes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (cooperative_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_purposes TO authenticated;
GRANT ALL ON public.loan_purposes TO service_role;
ALTER TABLE public.loan_purposes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_purposes_read" ON public.loan_purposes FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "loan_purposes_write" ON public.loan_purposes FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'loans.configure', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'loans.configure', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));
CREATE TRIGGER loan_purposes_updated_at BEFORE UPDATE ON public.loan_purposes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== APPROVAL LIMITS ==========
CREATE TABLE public.loan_approval_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  label text NOT NULL,
  minimum_amount numeric(18,2) NOT NULL DEFAULT 0,
  maximum_amount numeric(18,2),
  required_role public.app_role,
  requires_committee boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_approval_limits TO authenticated;
GRANT ALL ON public.loan_approval_limits TO service_role;
ALTER TABLE public.loan_approval_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_limits_read" ON public.loan_approval_limits FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "loan_limits_write" ON public.loan_approval_limits FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'loans.configure', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'loans.configure', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));
CREATE TRIGGER loan_limits_updated_at BEFORE UPDATE ON public.loan_approval_limits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== APPLICATIONS ==========
CREATE TABLE public.loan_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  application_number text NOT NULL,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  loan_product_id uuid NOT NULL REFERENCES public.loan_products(id) ON DELETE RESTRICT,
  requested_amount numeric(18,2) NOT NULL,
  recommended_amount numeric(18,2),
  approved_amount numeric(18,2),
  requested_tenure integer NOT NULL,
  approved_tenure integer,
  repayment_frequency public.contribution_frequency NOT NULL DEFAULT 'MONTHLY',
  purpose text,
  purpose_description text,
  application_date date NOT NULL DEFAULT CURRENT_DATE,
  application_status public.loan_application_status NOT NULL DEFAULT 'DRAFT',
  eligibility_status public.loan_eligibility_status NOT NULL DEFAULT 'NOT_CHECKED',
  credit_status text NOT NULL DEFAULT 'NOT_ASSESSED',
  approval_status text NOT NULL DEFAULT 'PENDING',
  disbursement_status text NOT NULL DEFAULT 'NOT_DUE',
  calculated_maximum_amount numeric(18,2),
  calculated_affordable_amount numeric(18,2),
  calculated_credit_limit numeric(18,2),
  committee_override_amount numeric(18,2),
  override_reason text,
  requested_disbursement_account_id uuid REFERENCES public.member_bank_accounts(id) ON DELETE SET NULL,
  notes text,
  submitted_at timestamptz,
  checked_by uuid,
  checked_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (cooperative_id, application_number)
);
CREATE INDEX loan_applications_member_idx ON public.loan_applications(member_id);
CREATE INDEX loan_applications_status_idx ON public.loan_applications(cooperative_id, application_status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_applications TO authenticated;
GRANT ALL ON public.loan_applications TO service_role;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_applications_staff" ON public.loan_applications FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'loans.view', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'loans.create', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "loan_applications_member_read" ON public.loan_applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = loan_applications.member_id AND m.user_id = auth.uid()));
CREATE TRIGGER loan_applications_updated_at BEFORE UPDATE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER loan_applications_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TABLE public.loan_application_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  loan_application_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  from_status public.loan_application_status,
  to_status public.loan_application_status NOT NULL,
  reason text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loan_status_history_app_idx ON public.loan_application_status_history(loan_application_id);
GRANT SELECT, INSERT ON public.loan_application_status_history TO authenticated;
GRANT ALL ON public.loan_application_status_history TO service_role;
ALTER TABLE public.loan_application_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_status_history_read" ON public.loan_application_status_history FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "loan_status_history_insert" ON public.loan_application_status_history FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of_cooperative(cooperative_id, auth.uid()));

CREATE TABLE public.loan_eligibility_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  loan_application_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  evaluated_by uuid,
  status public.loan_eligibility_status NOT NULL,
  savings_based_limit numeric(18,2),
  income_based_limit numeric(18,2),
  policy_based_limit numeric(18,2),
  binding_limit numeric(18,2),
  net_savings numeric(18,2),
  net_salary numeric(18,2),
  existing_obligations numeric(18,2),
  proposed_installment numeric(18,2),
  debt_service_ratio numeric(9,4),
  membership_months integer,
  contribution_months integer,
  existing_loan_exposure numeric(18,2),
  guarantee_exposure numeric(18,2),
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loan_eligibility_app_idx ON public.loan_eligibility_results(loan_application_id);
GRANT SELECT, INSERT ON public.loan_eligibility_results TO authenticated;
GRANT ALL ON public.loan_eligibility_results TO service_role;
ALTER TABLE public.loan_eligibility_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_eligibility_read" ON public.loan_eligibility_results FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "loan_eligibility_insert" ON public.loan_eligibility_results FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of_cooperative(cooperative_id, auth.uid()));

-- ========== GUARANTORS ==========
CREATE TABLE public.loan_guarantors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  loan_application_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  guarantor_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  amount_guaranteed numeric(18,2) NOT NULL DEFAULT 0,
  status public.loan_guarantor_status NOT NULL DEFAULT 'PENDING',
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  response_comment text,
  offset_authorised boolean NOT NULL DEFAULT false,
  terms_version text,
  acceptance_statement text,
  acceptance_user uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (loan_application_id, guarantor_member_id)
);
CREATE INDEX loan_guarantors_member_idx ON public.loan_guarantors(guarantor_member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_guarantors TO authenticated;
GRANT ALL ON public.loan_guarantors TO service_role;
ALTER TABLE public.loan_guarantors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_guarantors_staff" ON public.loan_guarantors FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'loans.view', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'loans.manage_guarantors', auth.uid()) OR public.has_permission(cooperative_id, 'loans.create', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "loan_guarantors_self_read" ON public.loan_guarantors FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = loan_guarantors.guarantor_member_id AND m.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.loan_applications a JOIN public.members m2 ON m2.id = a.member_id WHERE a.id = loan_guarantors.loan_application_id AND m2.user_id = auth.uid()));
CREATE POLICY "loan_guarantors_self_respond" ON public.loan_guarantors FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = loan_guarantors.guarantor_member_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.members m WHERE m.id = loan_guarantors.guarantor_member_id AND m.user_id = auth.uid()));
CREATE TRIGGER loan_guarantors_updated_at BEFORE UPDATE ON public.loan_guarantors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER loan_guarantors_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_guarantors FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ========== SECURITIES ==========
CREATE TABLE public.loan_securities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  loan_application_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  security_type public.loan_security_type NOT NULL,
  description text,
  value numeric(18,2) NOT NULL DEFAULT 0,
  haircut_percentage numeric(6,2) NOT NULL DEFAULT 0,
  eligible_value numeric(18,2) NOT NULL DEFAULT 0,
  document_id uuid REFERENCES public.member_documents(id) ON DELETE SET NULL,
  status public.loan_security_status NOT NULL DEFAULT 'PROPOSED',
  verified_by uuid,
  verified_at timestamptz,
  release_status text NOT NULL DEFAULT 'HELD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX loan_securities_app_idx ON public.loan_securities(loan_application_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_securities TO authenticated;
GRANT ALL ON public.loan_securities TO service_role;
ALTER TABLE public.loan_securities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_securities_staff" ON public.loan_securities FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'loans.view', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'loans.manage_security', auth.uid()) OR public.has_permission(cooperative_id, 'loans.create', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "loan_securities_member_read" ON public.loan_securities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loan_applications a JOIN public.members m ON m.id = a.member_id WHERE a.id = loan_securities.loan_application_id AND m.user_id = auth.uid()));
CREATE TRIGGER loan_securities_updated_at BEFORE UPDATE ON public.loan_securities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== CREDIT ASSESSMENT ==========
CREATE TABLE public.loan_credit_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  loan_application_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  savings_position numeric(18,2),
  credit_limit numeric(18,2),
  proposed_amount numeric(18,2),
  affordable_amount numeric(18,2),
  debt_service_ratio numeric(9,4),
  contribution_score numeric(6,2),
  eligibility_score numeric(6,2),
  risk_rating public.loan_risk_rating,
  analyst_recommendation text,
  recommended_amount numeric(18,2),
  analyst_comments text,
  assessment_status public.loan_assessment_status NOT NULL DEFAULT 'DRAFT',
  assessed_by uuid,
  assessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loan_assessments_app_idx ON public.loan_credit_assessments(loan_application_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_credit_assessments TO authenticated;
GRANT ALL ON public.loan_credit_assessments TO service_role;
ALTER TABLE public.loan_credit_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_assessments_staff" ON public.loan_credit_assessments FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'loans.view', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'loans.assess', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));
CREATE TRIGGER loan_assessments_updated_at BEFORE UPDATE ON public.loan_credit_assessments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER loan_assessments_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_credit_assessments FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ========== LOANS ==========
CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  loan_number text NOT NULL,
  application_id uuid REFERENCES public.loan_applications(id) ON DELETE SET NULL,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  loan_product_id uuid NOT NULL REFERENCES public.loan_products(id) ON DELETE RESTRICT,
  principal_amount numeric(18,2) NOT NULL DEFAULT 0,
  approved_amount numeric(18,2) NOT NULL DEFAULT 0,
  disbursed_amount numeric(18,2) NOT NULL DEFAULT 0,
  outstanding_principal numeric(18,2) NOT NULL DEFAULT 0,
  accrued_interest numeric(18,2) NOT NULL DEFAULT 0,
  outstanding_interest numeric(18,2) NOT NULL DEFAULT 0,
  outstanding_fees numeric(18,2) NOT NULL DEFAULT 0,
  total_outstanding numeric(18,2) NOT NULL DEFAULT 0,
  total_interest numeric(18,2) NOT NULL DEFAULT 0,
  interest_method public.loan_interest_method NOT NULL,
  interest_rate numeric(9,4) NOT NULL DEFAULT 0,
  tenure integer NOT NULL,
  tenure_unit public.loan_tenure_unit NOT NULL DEFAULT 'MONTHS',
  repayment_frequency public.contribution_frequency NOT NULL DEFAULT 'MONTHLY',
  installment_amount numeric(18,2) NOT NULL DEFAULT 0,
  start_date date,
  maturity_date date,
  status public.loan_account_status NOT NULL DEFAULT 'PENDING_DISBURSEMENT',
  schedule_version integer NOT NULL DEFAULT 1,
  disbursement_status text NOT NULL DEFAULT 'PENDING',
  disbursed_at timestamptz,
  disbursed_by uuid,
  disbursement_account_id uuid REFERENCES public.member_bank_accounts(id) ON DELETE SET NULL,
  disbursement_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (cooperative_id, loan_number)
);
CREATE INDEX loans_member_idx ON public.loans(member_id);
CREATE INDEX loans_status_idx ON public.loans(cooperative_id, status);
GRANT SELECT, INSERT, UPDATE ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loans_staff" ON public.loans FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'loans.view', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'loans.disburse', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "loans_member_read" ON public.loans FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = loans.member_id AND m.user_id = auth.uid()));
CREATE TRIGGER loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER loans_audit AFTER INSERT OR UPDATE OR DELETE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ========== SCHEDULES ==========
CREATE TABLE public.loan_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  loan_application_id uuid REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  loan_id uuid REFERENCES public.loans(id) ON DELETE CASCADE,
  schedule_version integer NOT NULL DEFAULT 1,
  interest_method public.loan_interest_method NOT NULL,
  interest_rate numeric(9,4) NOT NULL DEFAULT 0,
  principal numeric(18,2) NOT NULL DEFAULT 0,
  total_interest numeric(18,2) NOT NULL DEFAULT 0,
  total_fees numeric(18,2) NOT NULL DEFAULT 0,
  total_repayment numeric(18,2) NOT NULL DEFAULT 0,
  installment_amount numeric(18,2) NOT NULL DEFAULT 0,
  number_of_periods integer NOT NULL DEFAULT 0,
  start_date date,
  status text NOT NULL DEFAULT 'PROJECTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX loan_schedules_app_idx ON public.loan_schedules(loan_application_id);
CREATE INDEX loan_schedules_loan_idx ON public.loan_schedules(loan_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_schedules TO authenticated;
GRANT ALL ON public.loan_schedules TO service_role;
ALTER TABLE public.loan_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_schedules_staff" ON public.loan_schedules FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'loans.view', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'loans.create', auth.uid()) OR public.has_permission(cooperative_id, 'loans.disburse', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "loan_schedules_member_read" ON public.loan_schedules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loans l JOIN public.members m ON m.id = l.member_id WHERE l.id = loan_schedules.loan_id AND m.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.loan_applications a JOIN public.members m2 ON m2.id = a.member_id WHERE a.id = loan_schedules.loan_application_id AND m2.user_id = auth.uid()));
CREATE TRIGGER loan_schedules_updated_at BEFORE UPDATE ON public.loan_schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.loan_schedule_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES public.loan_schedules(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  opening_principal numeric(18,2) NOT NULL DEFAULT 0,
  principal numeric(18,2) NOT NULL DEFAULT 0,
  interest numeric(18,2) NOT NULL DEFAULT 0,
  fees numeric(18,2) NOT NULL DEFAULT 0,
  total_due numeric(18,2) NOT NULL DEFAULT 0,
  closing_principal numeric(18,2) NOT NULL DEFAULT 0,
  paid_principal numeric(18,2) NOT NULL DEFAULT 0,
  paid_interest numeric(18,2) NOT NULL DEFAULT 0,
  paid_fees numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'DUE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, installment_number)
);
CREATE INDEX loan_schedule_lines_schedule_idx ON public.loan_schedule_lines(schedule_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_schedule_lines TO authenticated;
GRANT ALL ON public.loan_schedule_lines TO service_role;
ALTER TABLE public.loan_schedule_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_schedule_lines_read" ON public.loan_schedule_lines FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.loan_schedules s LEFT JOIN public.loans l ON l.id = s.loan_id LEFT JOIN public.loan_applications a ON a.id = s.loan_application_id
                 JOIN public.members m ON m.id = COALESCE(l.member_id, a.member_id)
                 WHERE s.id = loan_schedule_lines.schedule_id AND m.user_id = auth.uid()));
CREATE POLICY "loan_schedule_lines_write" ON public.loan_schedule_lines FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'loans.view', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'loans.create', auth.uid()) OR public.has_permission(cooperative_id, 'loans.disburse', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));

-- ========== LOAN TRANSACTIONS ==========
CREATE TABLE public.loan_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  transaction_number text,
  transaction_type public.loan_transaction_type NOT NULL,
  status public.loan_transaction_status NOT NULL DEFAULT 'POSTED',
  amount numeric(18,2) NOT NULL,
  principal_component numeric(18,2) NOT NULL DEFAULT 0,
  interest_component numeric(18,2) NOT NULL DEFAULT 0,
  fee_component numeric(18,2) NOT NULL DEFAULT 0,
  penalty_component numeric(18,2) NOT NULL DEFAULT 0,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  posting_date date NOT NULL DEFAULT CURRENT_DATE,
  reference text,
  source text NOT NULL DEFAULT 'MANUAL',
  narration text,
  reversal_of uuid REFERENCES public.loan_transactions(id) ON DELETE SET NULL,
  reversal_reason text,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX loan_transactions_loan_idx ON public.loan_transactions(loan_id);
GRANT SELECT, INSERT, UPDATE ON public.loan_transactions TO authenticated;
GRANT ALL ON public.loan_transactions TO service_role;
ALTER TABLE public.loan_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_transactions_staff" ON public.loan_transactions FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'loans.view', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id, 'loans.disburse', auth.uid()) OR public.has_permission(cooperative_id, 'loans.reverse', auth.uid()) OR public.can_admin_cooperative(cooperative_id, auth.uid()));
CREATE POLICY "loan_transactions_member_read" ON public.loan_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = loan_transactions.member_id AND m.user_id = auth.uid()));
CREATE TRIGGER loan_transactions_updated_at BEFORE UPDATE ON public.loan_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER loan_transactions_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_transactions FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- posted loan transactions are immutable except for the reversal marker
CREATE OR REPLACE FUNCTION public.enforce_loan_transaction_immutability()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'POSTED' THEN RAISE EXCEPTION 'Posted loan transactions cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'POSTED' THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.transaction_type IS DISTINCT FROM OLD.transaction_type
       OR NEW.loan_id IS DISTINCT FROM OLD.loan_id
       OR NEW.principal_component IS DISTINCT FROM OLD.principal_component
       OR NEW.interest_component IS DISTINCT FROM OLD.interest_component
       OR NEW.fee_component IS DISTINCT FROM OLD.fee_component
       OR NEW.penalty_component IS DISTINCT FROM OLD.penalty_component
       OR NEW.transaction_date IS DISTINCT FROM OLD.transaction_date THEN
      RAISE EXCEPTION 'Posted loan transactions cannot be edited. Use a reversal.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER loan_transactions_immutable BEFORE UPDATE OR DELETE ON public.loan_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_loan_transaction_immutability();

-- balances derived from posted transactions only
CREATE OR REPLACE FUNCTION public.recalc_loan_balances(_loan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_disbursed numeric := 0;
  v_principal numeric := 0;
  v_interest_charged numeric := 0;
  v_interest_paid numeric := 0;
  v_fees_charged numeric := 0;
  v_fees_paid numeric := 0;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN transaction_type = 'DISBURSEMENT' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type IN ('DISBURSEMENT','RESTRUCTURE_ADJUSTMENT','ADJUSTMENT_DEBIT') THEN principal_component
                      WHEN transaction_type IN ('PRINCIPAL_REPAYMENT','WRITE_OFF','ADJUSTMENT_CREDIT') THEN -principal_component
                      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type IN ('INTEREST_ACCRUAL','PENALTY_CHARGE') THEN interest_component + penalty_component ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type IN ('INTEREST_REPAYMENT','PENALTY_REPAYMENT') THEN interest_component + penalty_component ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'FEE_CHARGE' THEN fee_component ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'FEE_REPAYMENT' THEN fee_component ELSE 0 END), 0)
  INTO v_disbursed, v_principal, v_interest_charged, v_interest_paid, v_fees_charged, v_fees_paid
  FROM public.loan_transactions
  WHERE loan_id = _loan_id AND status = 'POSTED';

  UPDATE public.loans
  SET disbursed_amount = v_disbursed,
      outstanding_principal = GREATEST(v_principal, 0),
      accrued_interest = v_interest_charged,
      outstanding_interest = GREATEST(v_interest_charged - v_interest_paid, 0),
      outstanding_fees = GREATEST(v_fees_charged - v_fees_paid, 0),
      total_outstanding = GREATEST(v_principal, 0) + GREATEST(v_interest_charged - v_interest_paid, 0) + GREATEST(v_fees_charged - v_fees_paid, 0)
  WHERE id = _loan_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recalc_loan_balances(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalc_loan_balances(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.loan_balance_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalc_loan_balances(COALESCE(NEW.loan_id, OLD.loan_id));
  RETURN NULL;
END;
$$;
CREATE TRIGGER loan_transactions_balance_sync AFTER INSERT OR UPDATE ON public.loan_transactions
  FOR EACH ROW EXECUTE FUNCTION public.loan_balance_sync();

-- ========== NUMBERING ==========
CREATE OR REPLACE FUNCTION public.next_loan_application_number(_cooperative_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  SELECT COUNT(*) + 1 INTO n FROM public.loan_applications WHERE cooperative_id = _cooperative_id;
  RETURN 'LA-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_loan_application_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_loan_application_number(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.next_loan_number(_cooperative_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  SELECT COUNT(*) + 1 INTO n FROM public.loans WHERE cooperative_id = _cooperative_id;
  RETURN 'LN-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_loan_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_loan_number(uuid) TO authenticated, service_role;

-- ========== PERMISSIONS ==========
INSERT INTO public.permissions (code, module, resource, action, description) VALUES
  ('loans.assess', 'loans', 'loans', 'ASSESS', 'Run loan credit assessments'),
  ('loans.check', 'loans', 'loans', 'CHECK', 'Check loan applications'),
  ('loans.configure', 'loans', 'loans', 'CONFIGURE', 'Configure loan products, purposes and approval limits'),
  ('loans.reverse', 'loans', 'loans', 'REVERSE', 'Reverse loan transactions'),
  ('loans.export', 'loans', 'loans', 'EXPORT', 'Export loan data'),
  ('loans.manage_guarantors', 'loans', 'loans', 'MANAGE', 'Manage loan guarantors'),
  ('loans.manage_security', 'loans', 'loans', 'MANAGE_SECURITY', 'Manage loan security and collateral')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.module = 'loans'
WHERE r.key IN ('COOPERATIVE_ADMIN','COOPERATIVE_MANAGER','PLATFORM_SUPER_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
  ON p.code IN ('loans.view','loans.create','loans.assess','loans.manage_guarantors','loans.manage_security','loans.export')
WHERE r.key = 'LOAN_OFFICER'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN ('loans.view','loans.check')
WHERE r.key = 'CHECKER'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN ('loans.view','loans.approve')
WHERE r.key = 'APPROVER'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN ('loans.view','loans.disburse','loans.export')
WHERE r.key = 'TREASURER'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN ('loans.view','loans.export')
WHERE r.key IN ('ACCOUNTANT','AUDITOR','PLATFORM_AUDITOR')
ON CONFLICT DO NOTHING;

-- ========== SAMPLE PRODUCTS (editable, no balances) ==========
INSERT INTO public.loan_products (
  cooperative_id, product_code, product_name, description, loan_category, minimum_amount, maximum_amount,
  minimum_tenure, maximum_tenure, interest_method, interest_rate, savings_multiplier,
  minimum_membership_months, minimum_savings_months, guarantor_required, minimum_guarantors, maximum_guarantors,
  self_guarantee_allowed, is_sample)
SELECT c.id, v.code, v.name, v.descr, v.category, 0, NULL,
       1, v.tenure, 'FLAT'::public.loan_interest_method, v.rate, v.multiplier,
       v.min_membership, v.min_savings, v.guar_required, v.min_guar, 3, true, true
FROM public.cooperatives c
CROSS JOIN (VALUES
  ('NORMAL','Normal Loan','Sample configuration — 12 months, up to 2x net savings.','NORMAL',12,5.0,2.0,12,12,true,2),
  ('SPECIAL','Special Loan','Sample configuration — 12 months, up to 5x net savings.','SPECIAL',12,12.5,5.0,12,12,true,2),
  ('ST6','Short-Term Loan (6 Months)','Sample configuration — 6 months, up to 5x net savings.','SHORT_TERM',6,6.0,5.0,6,6,true,1),
  ('ST3','Short-Term Loan (3 Months)','Sample configuration — 3 months, up to 5x net savings.','SHORT_TERM',3,4.0,5.0,6,6,true,1),
  ('ST1','Short-Term Loan (1 Month)','Sample configuration — 1 month, up to 5x net savings.','SHORT_TERM',1,3.0,5.0,3,3,false,0),
  ('COMMODITY','Commodity Loan','Sample configuration — 12 months.','COMMODITY',12,5.0,NULL,12,12,true,2),
  ('INVESTMENT','Investment Loan','Sample configuration — 48 months.','INVESTMENT',48,11.75,NULL,24,24,true,2),
  ('LPO','LPO Financing','Sample configuration — 3 months.','LPO',3,7.5,NULL,12,12,true,2)
) AS v(code, name, descr, category, tenure, rate, multiplier, min_membership, min_savings, guar_required, min_guar)
ON CONFLICT (cooperative_id, product_code) DO NOTHING;
