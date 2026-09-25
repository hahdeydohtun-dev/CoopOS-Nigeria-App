
-- ENUMS
CREATE TYPE public.checkoff_batch_status AS ENUM ('DRAFT','UPLOADED','PARSING','VALIDATING','VALIDATION_COMPLETE','EXCEPTION_REVIEW','READY_FOR_APPROVAL','CHECKED','APPROVED','PROCESSING','POSTED','PARTIALLY_POSTED','REJECTED','FAILED','REVERSED','CANCELLED','CLOSED');
CREATE TYPE public.checkoff_source_type AS ENUM ('PAYROLL_FILE','CSV','EXCEL','API','BANK_ADVICE','MANUAL_ENTRY','PREVIOUS_BATCH_TEMPLATE','OTHER');
CREATE TYPE public.checkoff_match_status AS ENUM ('UNMATCHED','EXACT_MATCH','STRONG_MATCH','POSSIBLE_MATCH','MANUAL_MATCH','MULTIPLE_MATCHES','REJECTED');
CREATE TYPE public.checkoff_deduction_type AS ENUM ('ORDINARY_SAVINGS','SPECIAL_SAVINGS','SHARE_CONTRIBUTION','LOAN_REPAYMENT','INSURANCE','OTHER_DEDUCTION');
CREATE TYPE public.checkoff_line_posting_status AS ENUM ('PENDING','HELD','POSTED','DEFERRED','REJECTED','REVERSED');
CREATE TYPE public.checkoff_exception_severity AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW');
CREATE TYPE public.checkoff_settlement_status AS ENUM ('EXPECTED','PARTIALLY_RECEIVED','RECEIVED','VARIANCE','UNIDENTIFIED','RECONCILED');

-- PROFILES
CREATE TABLE public.checkoff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  profile_name text NOT NULL,
  employer_name text NOT NULL,
  employer_code text,
  payroll_frequency public.contribution_frequency NOT NULL DEFAULT 'MONTHLY',
  payroll_provider text,
  file_format text NOT NULL DEFAULT 'CSV',
  file_type text,
  expected_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  member_matching_method text NOT NULL DEFAULT 'MEMBER_NUMBER,EMPLOYEE_ID,STAFF_NUMBER,PHONE,EMAIL,NAME',
  default_savings_product_id uuid REFERENCES public.savings_products(id),
  contribution_rule_id uuid REFERENCES public.cooperative_rules(id),
  auto_match_threshold numeric(5,2) NOT NULL DEFAULT 95,
  review_threshold numeric(5,2) NOT NULL DEFAULT 70,
  variance_tolerance numeric(18,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  UNIQUE (cooperative_id, profile_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkoff_profiles TO authenticated;
GRANT ALL ON public.checkoff_profiles TO service_role;
ALTER TABLE public.checkoff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY cop_read ON public.checkoff_profiles FOR SELECT TO authenticated
  USING (public.has_permission(cooperative_id,'checkoff.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));
CREATE POLICY cop_write ON public.checkoff_profiles FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id,'checkoff.manage_profiles',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id,'checkoff.manage_profiles',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));

-- COLUMN MAPPINGS
CREATE TABLE public.checkoff_column_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  checkoff_profile_id uuid NOT NULL REFERENCES public.checkoff_profiles(id) ON DELETE CASCADE,
  source_column text NOT NULL,
  target_field text NOT NULL,
  transform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  UNIQUE (checkoff_profile_id, target_field)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkoff_column_mappings TO authenticated;
GRANT ALL ON public.checkoff_column_mappings TO service_role;
ALTER TABLE public.checkoff_column_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ccm_read ON public.checkoff_column_mappings FOR SELECT TO authenticated
  USING (public.has_permission(cooperative_id,'checkoff.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));
CREATE POLICY ccm_write ON public.checkoff_column_mappings FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id,'checkoff.manage_mappings',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id,'checkoff.manage_mappings',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));

-- BATCHES
CREATE TABLE public.checkoff_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  checkoff_profile_id uuid REFERENCES public.checkoff_profiles(id),
  period_id uuid REFERENCES public.contribution_periods(id),
  batch_number text NOT NULL,
  payroll_period text NOT NULL,
  payroll_start_date date,
  payroll_end_date date,
  deduction_date date NOT NULL DEFAULT CURRENT_DATE,
  file_name text,
  file_fingerprint text,
  source_type public.checkoff_source_type NOT NULL DEFAULT 'CSV',
  notes text,
  total_records integer NOT NULL DEFAULT 0,
  total_gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  total_valid_amount numeric(18,2) NOT NULL DEFAULT 0,
  total_exception_amount numeric(18,2) NOT NULL DEFAULT 0,
  total_matched_amount numeric(18,2) NOT NULL DEFAULT 0,
  total_unmatched_amount numeric(18,2) NOT NULL DEFAULT 0,
  total_posted_amount numeric(18,2) NOT NULL DEFAULT 0,
  unapplied_amount numeric(18,2) NOT NULL DEFAULT 0,
  status public.checkoff_batch_status NOT NULL DEFAULT 'DRAFT',
  corrects_batch_id uuid REFERENCES public.checkoff_batches(id),
  uploaded_by uuid, reviewed_by uuid, checked_by uuid, approved_by uuid, posted_by uuid, reversed_by uuid,
  uploaded_at timestamptz, approved_at timestamptz, posted_at timestamptz, reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  UNIQUE (cooperative_id, batch_number)
);
CREATE INDEX idx_cob_coop ON public.checkoff_batches(cooperative_id);
CREATE INDEX idx_cob_profile ON public.checkoff_batches(checkoff_profile_id);
CREATE INDEX idx_cob_period ON public.checkoff_batches(payroll_period);
CREATE INDEX idx_cob_status ON public.checkoff_batches(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkoff_batches TO authenticated;
GRANT ALL ON public.checkoff_batches TO service_role;
ALTER TABLE public.checkoff_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY cob_read ON public.checkoff_batches FOR SELECT TO authenticated
  USING (public.has_permission(cooperative_id,'checkoff.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));
CREATE POLICY cob_write ON public.checkoff_batches FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id,'checkoff.create',auth.uid()) OR public.has_permission(cooperative_id,'checkoff.approve',auth.uid()) OR public.has_permission(cooperative_id,'checkoff.post',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id,'checkoff.create',auth.uid()) OR public.has_permission(cooperative_id,'checkoff.approve',auth.uid()) OR public.has_permission(cooperative_id,'checkoff.post',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));

-- BATCH LINES
CREATE TABLE public.checkoff_batch_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.checkoff_batches(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  employee_id text,
  staff_number text,
  member_number text,
  employee_name text,
  department text,
  deduction_type public.checkoff_deduction_type NOT NULL DEFAULT 'ORDINARY_SAVINGS',
  savings_product_id uuid REFERENCES public.savings_products(id),
  deduction_amount numeric(18,2) NOT NULL DEFAULT 0,
  payroll_date date,
  source_reference text,
  matched_member_id uuid REFERENCES public.members(id),
  matched_savings_account_id uuid REFERENCES public.member_savings_accounts(id),
  match_status public.checkoff_match_status NOT NULL DEFAULT 'UNMATCHED',
  match_confidence numeric(5,2) NOT NULL DEFAULT 0,
  match_basis text,
  manual_match_reason text,
  matched_by uuid,
  matched_at timestamptz,
  expected_amount numeric(18,2),
  variance_amount numeric(18,2),
  compliance_status public.contribution_compliance_status,
  allocation_status text NOT NULL DEFAULT 'PENDING',
  posting_status public.checkoff_line_posting_status NOT NULL DEFAULT 'PENDING',
  exception_status text NOT NULL DEFAULT 'NONE',
  savings_transaction_id uuid REFERENCES public.savings_transactions(id),
  allocation_id uuid REFERENCES public.contribution_allocations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, line_number)
);
CREATE INDEX idx_cobl_batch ON public.checkoff_batch_lines(batch_id);
CREATE INDEX idx_cobl_coop ON public.checkoff_batch_lines(cooperative_id);
CREATE INDEX idx_cobl_member ON public.checkoff_batch_lines(matched_member_id);
CREATE INDEX idx_cobl_employee ON public.checkoff_batch_lines(employee_id);
CREATE INDEX idx_cobl_membernum ON public.checkoff_batch_lines(member_number);
CREATE INDEX idx_cobl_match ON public.checkoff_batch_lines(match_status);
CREATE INDEX idx_cobl_posting ON public.checkoff_batch_lines(posting_status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkoff_batch_lines TO authenticated;
GRANT ALL ON public.checkoff_batch_lines TO service_role;
ALTER TABLE public.checkoff_batch_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY cobl_read ON public.checkoff_batch_lines FOR SELECT TO authenticated
  USING (
    public.has_permission(cooperative_id,'checkoff.view',auth.uid())
    OR public.can_admin_cooperative(cooperative_id,auth.uid())
    OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = matched_member_id AND m.user_id = auth.uid())
  );
CREATE POLICY cobl_write ON public.checkoff_batch_lines FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id,'checkoff.create',auth.uid()) OR public.has_permission(cooperative_id,'checkoff.match',auth.uid()) OR public.has_permission(cooperative_id,'checkoff.post',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id,'checkoff.create',auth.uid()) OR public.has_permission(cooperative_id,'checkoff.match',auth.uid()) OR public.has_permission(cooperative_id,'checkoff.post',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));

-- EXCEPTIONS
CREATE TABLE public.checkoff_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.checkoff_batches(id) ON DELETE CASCADE,
  batch_line_id uuid REFERENCES public.checkoff_batch_lines(id) ON DELETE CASCADE,
  exception_type text NOT NULL,
  severity public.checkoff_exception_severity NOT NULL DEFAULT 'MEDIUM',
  message text NOT NULL,
  suggested_action text,
  resolved boolean NOT NULL DEFAULT false,
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coe_batch ON public.checkoff_exceptions(batch_id);
CREATE INDEX idx_coe_resolved ON public.checkoff_exceptions(resolved);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkoff_exceptions TO authenticated;
GRANT ALL ON public.checkoff_exceptions TO service_role;
ALTER TABLE public.checkoff_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY coe_read ON public.checkoff_exceptions FOR SELECT TO authenticated
  USING (public.has_permission(cooperative_id,'checkoff.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));
CREATE POLICY coe_write ON public.checkoff_exceptions FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id,'checkoff.resolve_exceptions',auth.uid()) OR public.has_permission(cooperative_id,'checkoff.create',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id,'checkoff.resolve_exceptions',auth.uid()) OR public.has_permission(cooperative_id,'checkoff.create',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));

-- SETTLEMENTS
CREATE TABLE public.checkoff_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.checkoff_batches(id) ON DELETE CASCADE,
  expected_settlement_date date,
  expected_amount numeric(18,2) NOT NULL DEFAULT 0,
  actual_settlement_date date,
  actual_amount numeric(18,2),
  bank_account text,
  bank_reference text,
  variance numeric(18,2),
  status public.checkoff_settlement_status NOT NULL DEFAULT 'EXPECTED',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);
CREATE INDEX idx_cos_batch ON public.checkoff_settlements(batch_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkoff_settlements TO authenticated;
GRANT ALL ON public.checkoff_settlements TO service_role;
ALTER TABLE public.checkoff_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY cos_read ON public.checkoff_settlements FOR SELECT TO authenticated
  USING (public.has_permission(cooperative_id,'checkoff.view_settlement',auth.uid()) OR public.has_permission(cooperative_id,'checkoff.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));
CREATE POLICY cos_write ON public.checkoff_settlements FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id,'checkoff.reconcile',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()))
  WITH CHECK (public.has_permission(cooperative_id,'checkoff.reconcile',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));

-- CORRECTIONS
CREATE TABLE public.checkoff_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  original_batch_id uuid NOT NULL REFERENCES public.checkoff_batches(id) ON DELETE CASCADE,
  correction_batch_id uuid REFERENCES public.checkoff_batches(id) ON DELETE SET NULL,
  reason text NOT NULL,
  difference_amount numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);
GRANT SELECT, INSERT ON public.checkoff_corrections TO authenticated;
GRANT ALL ON public.checkoff_corrections TO service_role;
ALTER TABLE public.checkoff_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY coc_read ON public.checkoff_corrections FOR SELECT TO authenticated
  USING (public.has_permission(cooperative_id,'checkoff.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));
CREATE POLICY coc_write ON public.checkoff_corrections FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(cooperative_id,'checkoff.create',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));

-- REVERSALS
CREATE TABLE public.checkoff_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.checkoff_batches(id) ON DELETE CASCADE,
  batch_line_id uuid REFERENCES public.checkoff_batch_lines(id) ON DELETE CASCADE,
  reason text NOT NULL,
  reversed_amount numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);
GRANT SELECT, INSERT ON public.checkoff_reversals TO authenticated;
GRANT ALL ON public.checkoff_reversals TO service_role;
ALTER TABLE public.checkoff_reversals ENABLE ROW LEVEL SECURITY;
CREATE POLICY cor_read ON public.checkoff_reversals FOR SELECT TO authenticated
  USING (public.has_permission(cooperative_id,'checkoff.view',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));
CREATE POLICY cor_write ON public.checkoff_reversals FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(cooperative_id,'checkoff.reverse',auth.uid()) OR public.can_admin_cooperative(cooperative_id,auth.uid()));

-- TRIGGERS
CREATE TRIGGER cop_upd BEFORE UPDATE ON public.checkoff_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ccm_upd BEFORE UPDATE ON public.checkoff_column_mappings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cob_upd BEFORE UPDATE ON public.checkoff_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cobl_upd BEFORE UPDATE ON public.checkoff_batch_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER coe_upd BEFORE UPDATE ON public.checkoff_exceptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cos_upd BEFORE UPDATE ON public.checkoff_settlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cob_audit AFTER INSERT OR UPDATE OR DELETE ON public.checkoff_batches FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER cop_audit AFTER INSERT OR UPDATE OR DELETE ON public.checkoff_profiles FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER cos_audit AFTER INSERT OR UPDATE OR DELETE ON public.checkoff_settlements FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- BATCH NUMBER GENERATOR
CREATE OR REPLACE FUNCTION public.next_checkoff_batch_number(_cooperative_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _n bigint;
BEGIN
  SELECT count(*) + 1 INTO _n FROM public.checkoff_batches WHERE cooperative_id = _cooperative_id;
  RETURN 'CO-' || to_char(now(),'YYYYMM') || '-' || lpad(_n::text, 5, '0');
END; $$;

-- PERMISSIONS
INSERT INTO public.permissions (code, module, resource, action, description) VALUES
 ('checkoff.view','checkoff','checkoff','view','View check-off batches'),
 ('checkoff.create','checkoff','checkoff','create','Create check-off batches'),
 ('checkoff.upload','checkoff','checkoff','upload','Upload payroll files'),
 ('checkoff.validate','checkoff','checkoff','validate','Validate check-off batches'),
 ('checkoff.match','checkoff','checkoff','match','Match payroll rows to members'),
 ('checkoff.resolve_exceptions','checkoff','checkoff','resolve_exceptions','Resolve check-off exceptions'),
 ('checkoff.check','checkoff','checkoff','check','Check check-off batches'),
 ('checkoff.approve','checkoff','checkoff','approve','Approve check-off batches'),
 ('checkoff.post','checkoff','checkoff','post','Post check-off batches'),
 ('checkoff.reverse','checkoff','checkoff','reverse','Reverse check-off postings'),
 ('checkoff.import','checkoff','checkoff','import','Import check-off data'),
 ('checkoff.export','checkoff','checkoff','export','Export check-off data'),
 ('checkoff.manage_profiles','checkoff','checkoff','manage_profiles','Manage employer payroll profiles'),
 ('checkoff.manage_mappings','checkoff','checkoff','manage_mappings','Manage payroll column mappings'),
 ('checkoff.view_settlement','checkoff','checkoff','view_settlement','View check-off settlements'),
 ('checkoff.reconcile','checkoff','checkoff','reconcile','Reconcile check-off settlements')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.module = 'checkoff'
WHERE (r.key IN ('COOPERATIVE_ADMIN','COOPERATIVE_MANAGER','PLATFORM_SUPER_ADMIN'))
   OR (r.key = 'PAYROLL_OFFICER' AND p.code IN ('checkoff.view','checkoff.create','checkoff.upload','checkoff.validate','checkoff.match','checkoff.resolve_exceptions','checkoff.import','checkoff.export','checkoff.manage_mappings'))
   OR (r.key = 'TREASURER' AND p.code IN ('checkoff.view','checkoff.check','checkoff.approve','checkoff.view_settlement','checkoff.export'))
   OR (r.key = 'ACCOUNTANT' AND p.code IN ('checkoff.view','checkoff.view_settlement','checkoff.reconcile','checkoff.export'))
   OR (r.key = 'CHECKER' AND p.code IN ('checkoff.view','checkoff.check'))
   OR (r.key = 'APPROVER' AND p.code IN ('checkoff.view','checkoff.approve','checkoff.post'))
   OR (r.key IN ('AUDITOR','PLATFORM_AUDITOR') AND p.code IN ('checkoff.view','checkoff.view_settlement','checkoff.export'))
ON CONFLICT DO NOTHING;
