CREATE TABLE public.savings_bonus_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  name text NOT NULL,
  savings_product_id uuid REFERENCES public.savings_products(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  basis text NOT NULL DEFAULT 'CLOSING_BALANCE',
  rate_percent numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'DRAFT',
  member_count integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  approved_by uuid,
  approved_at timestamptz,
  posted_by uuid,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.savings_bonus_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.savings_bonus_runs(id) ON DELETE CASCADE,
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  savings_account_id uuid NOT NULL REFERENCES public.member_savings_accounts(id) ON DELETE CASCADE,
  savings_product_id uuid NOT NULL REFERENCES public.savings_products(id),
  basis_amount numeric NOT NULL DEFAULT 0,
  bonus_amount numeric NOT NULL DEFAULT 0,
  transaction_id uuid REFERENCES public.savings_transactions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bonus_lines_run ON public.savings_bonus_lines(run_id);
CREATE INDEX idx_bonus_runs_coop ON public.savings_bonus_runs(cooperative_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_bonus_runs TO authenticated;
GRANT ALL ON public.savings_bonus_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_bonus_lines TO authenticated;
GRANT ALL ON public.savings_bonus_lines TO service_role;

ALTER TABLE public.savings_bonus_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_bonus_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY sbr_read ON public.savings_bonus_runs FOR SELECT TO authenticated
USING (has_permission(cooperative_id, 'savings.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()) OR is_platform_admin(auth.uid()));

CREATE POLICY sbr_write ON public.savings_bonus_runs FOR ALL TO authenticated
USING (has_permission(cooperative_id, 'savings.create', auth.uid()) OR has_permission(cooperative_id, 'savings.approve', auth.uid()) OR has_permission(cooperative_id, 'savings.post', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()))
WITH CHECK (has_permission(cooperative_id, 'savings.create', auth.uid()) OR has_permission(cooperative_id, 'savings.approve', auth.uid()) OR has_permission(cooperative_id, 'savings.post', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()));

CREATE POLICY sbl_read ON public.savings_bonus_lines FOR SELECT TO authenticated
USING ((EXISTS (SELECT 1 FROM public.members m WHERE m.id = savings_bonus_lines.member_id AND m.user_id = auth.uid()))
  OR has_permission(cooperative_id, 'savings.view', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()) OR is_platform_admin(auth.uid()));

CREATE POLICY sbl_write ON public.savings_bonus_lines FOR ALL TO authenticated
USING (has_permission(cooperative_id, 'savings.create', auth.uid()) OR has_permission(cooperative_id, 'savings.approve', auth.uid()) OR has_permission(cooperative_id, 'savings.post', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()))
WITH CHECK (has_permission(cooperative_id, 'savings.create', auth.uid()) OR has_permission(cooperative_id, 'savings.approve', auth.uid()) OR has_permission(cooperative_id, 'savings.post', auth.uid()) OR can_admin_cooperative(cooperative_id, auth.uid()));

CREATE TRIGGER trg_sbr_updated BEFORE UPDATE ON public.savings_bonus_runs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_sbr_audit AFTER INSERT OR UPDATE OR DELETE ON public.savings_bonus_runs
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();