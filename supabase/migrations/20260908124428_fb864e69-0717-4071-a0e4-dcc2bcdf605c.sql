
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM (
  'PLATFORM_SUPER_ADMIN','PLATFORM_SUPPORT','PLATFORM_AUDITOR',
  'COOPERATIVE_ADMIN','COOPERATIVE_MANAGER','TREASURER','ACCOUNTANT','LOAN_OFFICER',
  'CHECKER','APPROVER','AUDITOR','PAYROLL_OFFICER','SECRETARY','COMMITTEE_MEMBER','MEMBER'
);
CREATE TYPE public.user_status AS ENUM ('ACTIVE','INVITED','SUSPENDED','LOCKED','DISABLED');
CREATE TYPE public.cooperative_type AS ENUM (
  'THRIFT_AND_CREDIT','CONSUMER','MULTIPURPOSE','AGRICULTURAL','STAFF','HOUSING','OTHER'
);
CREATE TYPE public.cooperative_status AS ENUM ('ACTIVE','PENDING','SUSPENDED','CLOSED');
CREATE TYPE public.transaction_status AS ENUM (
  'DRAFT','PENDING','SUBMITTED','CHECKED','APPROVED','PROCESSING','COMPLETED',
  'REJECTED','FAILED','REVERSED','CANCELLED'
);
CREATE TYPE public.period_status AS ENUM ('OPEN','SOFT_CLOSED','CLOSED');
CREATE TYPE public.rule_value_type AS ENUM ('NUMERIC','TEXT','BOOLEAN','JSON');
CREATE TYPE public.account_type AS ENUM ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE');
CREATE TYPE public.member_status AS ENUM ('ACTIVE','PENDING','DORMANT','EXITED','SUSPENDED');
CREATE TYPE public.approval_action_type AS ENUM ('SUBMIT','CHECK','APPROVE','REJECT','CANCEL');

-- ============ SHARED TRIGGER ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ CORE TENANCY ============
CREATE TABLE public.cooperatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  trading_name text,
  registration_number text UNIQUE,
  cooperative_type public.cooperative_type NOT NULL DEFAULT 'THRIFT_AND_CREDIT',
  state text, lga text, address text, phone text, email text, website text,
  currency text NOT NULL DEFAULT 'NGN',
  financial_year_start date,
  agm_date date,
  status public.cooperative_status NOT NULL DEFAULT 'PENDING',
  logo_url text,
  primary_contact text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  name text NOT NULL, code text, state text, address text, phone text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (cooperative_id, code)
);
CREATE INDEX idx_branches_coop ON public.branches(cooperative_id);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  status public.user_status NOT NULL DEFAULT 'ACTIVE',
  is_platform_user boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ ROLES & PERMISSIONS ============
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  module text NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  key public.app_role NOT NULL,
  name text NOT NULL,
  description text,
  is_platform_role boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);
CREATE UNIQUE INDEX idx_roles_global_key ON public.roles(key) WHERE cooperative_id IS NULL;
CREATE UNIQUE INDEX idx_roles_coop_key ON public.roles(cooperative_id, key) WHERE cooperative_id IS NOT NULL;

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cooperative_id uuid REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  status public.user_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (user_id, cooperative_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_coop ON public.user_roles(cooperative_id);

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.status = 'ACTIVE'
      AND ur.role IN ('PLATFORM_SUPER_ADMIN','PLATFORM_SUPPORT','PLATFORM_AUDITOR')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _cooperative_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = _role AND ur.status = 'ACTIVE'
      AND (ur.cooperative_id = _cooperative_id OR ur.cooperative_id IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_member_of_cooperative(_cooperative_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.cooperative_id = _cooperative_id AND ur.status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_cooperative_id uuid, _permission text, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin(_user_id) OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r
      ON r.key = ur.role
     AND (r.cooperative_id = ur.cooperative_id OR r.cooperative_id IS NULL)
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND ur.status = 'ACTIVE'
      AND ur.cooperative_id = _cooperative_id
      AND p.code = _permission
  );
$$;

CREATE OR REPLACE FUNCTION public.can_admin_cooperative(_cooperative_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin(_user_id)
      OR public.has_role(_user_id, _cooperative_id, 'COOPERATIVE_ADMIN');
$$;

-- ============ MEMBERS ============
CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid,
  membership_number text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  other_names text,
  gender text,
  date_of_birth date,
  phone text, email text,
  employer text, staff_number text,
  join_date date NOT NULL DEFAULT current_date,
  status public.member_status NOT NULL DEFAULT 'PENDING',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (cooperative_id, membership_number)
);
CREATE INDEX idx_members_coop ON public.members(cooperative_id);
CREATE INDEX idx_members_user ON public.members(user_id);

-- ============ RULE ENGINE ============
CREATE TABLE public.cooperative_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  rule_name text NOT NULL,
  description text,
  category text,
  value_type public.rule_value_type NOT NULL,
  numeric_value numeric,
  text_value text,
  boolean_value boolean,
  json_value jsonb,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid, approved_by uuid,
  CONSTRAINT rule_value_present CHECK (
    (value_type = 'NUMERIC' AND numeric_value IS NOT NULL) OR
    (value_type = 'TEXT' AND text_value IS NOT NULL) OR
    (value_type = 'BOOLEAN' AND boolean_value IS NOT NULL) OR
    (value_type = 'JSON' AND json_value IS NOT NULL)
  ),
  CONSTRAINT rule_effective_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE UNIQUE INDEX idx_rules_active_key ON public.cooperative_rules(cooperative_id, rule_key, effective_from);
CREATE INDEX idx_rules_coop ON public.cooperative_rules(cooperative_id);

-- ============ ACCOUNTING ============
CREATE TABLE public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  account_type public.account_type NOT NULL,
  parent_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (cooperative_id, code)
);
CREATE INDEX idx_coa_coop ON public.chart_of_accounts(cooperative_id);

CREATE TABLE public.accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.period_status NOT NULL DEFAULT 'OPEN',
  closed_at timestamptz, closed_by uuid,
  reopened_at timestamptz, reopened_by uuid, reopen_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (cooperative_id, name),
  CONSTRAINT period_range CHECK (end_date >= start_date)
);
CREATE INDEX idx_periods_coop ON public.accounting_periods(cooperative_id);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  transaction_type text NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  transaction_date date NOT NULL DEFAULT current_date,
  value_date date,
  reference text,
  description text,
  source text NOT NULL DEFAULT 'MANUAL',
  status public.transaction_status NOT NULL DEFAULT 'DRAFT',
  created_by uuid, checked_by uuid, approved_by uuid,
  posted_at timestamptz,
  reversed_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (cooperative_id, reference)
);
CREATE INDEX idx_tx_coop ON public.transactions(cooperative_id);
CREATE INDEX idx_tx_member ON public.transactions(member_id);
CREATE INDEX idx_tx_status ON public.transactions(status);

CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  period_id uuid REFERENCES public.accounting_periods(id) ON DELETE SET NULL,
  posting_date date NOT NULL DEFAULT current_date,
  description text,
  status public.transaction_status NOT NULL DEFAULT 'DRAFT',
  posted_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, approved_by uuid, updated_by uuid
);
CREATE INDEX idx_je_coop ON public.journal_entries(cooperative_id);

CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  debit numeric(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_sided_line CHECK ((debit = 0) <> (credit = 0) OR (debit = 0 AND credit = 0))
);
CREATE INDEX idx_jl_journal ON public.journal_lines(journal_id);

-- Immutability + balance + period enforcement
CREATE OR REPLACE FUNCTION public.enforce_posted_transaction_immutability()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('COMPLETED','APPROVED','REVERSED') THEN
      RAISE EXCEPTION 'Posted financial transactions cannot be deleted. Use a reversal.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status IN ('COMPLETED','REVERSED') AND NEW.status NOT IN ('REVERSED') THEN
    RAISE EXCEPTION 'Posted transactions are immutable. Use a reversal transaction.';
  END IF;
  IF OLD.status = 'COMPLETED' AND (
       NEW.amount IS DISTINCT FROM OLD.amount OR
       NEW.member_id IS DISTINCT FROM OLD.member_id OR
       NEW.account_id IS DISTINCT FROM OLD.account_id OR
       NEW.transaction_date IS DISTINCT FROM OLD.transaction_date) THEN
    RAISE EXCEPTION 'Posted transactions are immutable.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_tx_immutable BEFORE UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_posted_transaction_immutability();

CREATE OR REPLACE FUNCTION public.enforce_journal_posting_rules()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE total_debit numeric; total_credit numeric; p_status public.period_status;
BEGIN
  IF NEW.status = 'COMPLETED' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'COMPLETED') THEN
    SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
      INTO total_debit, total_credit FROM public.journal_lines WHERE journal_id = NEW.id;
    IF total_debit <> total_credit OR total_debit = 0 THEN
      RAISE EXCEPTION 'Journal is unbalanced: debits % <> credits %', total_debit, total_credit;
    END IF;
    IF NEW.period_id IS NOT NULL THEN
      SELECT status INTO p_status FROM public.accounting_periods WHERE id = NEW.period_id;
      IF p_status = 'CLOSED' THEN
        RAISE EXCEPTION 'Cannot post into a CLOSED accounting period.';
      END IF;
    END IF;
    NEW.posted_at = COALESCE(NEW.posted_at, now());
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'COMPLETED' AND NEW.status <> 'REVERSED' AND NEW.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Posted journals are immutable.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_je_posting BEFORE INSERT OR UPDATE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.enforce_journal_posting_rules();

CREATE OR REPLACE FUNCTION public.protect_posted_journal_lines()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE j_status public.transaction_status;
BEGIN
  SELECT status INTO j_status FROM public.journal_entries
   WHERE id = COALESCE(NEW.journal_id, OLD.journal_id);
  IF j_status = 'COMPLETED' THEN
    RAISE EXCEPTION 'Lines of a posted journal cannot be changed.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_jl_protect BEFORE INSERT OR UPDATE OR DELETE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.protect_posted_journal_lines();

-- ============ APPROVALS ============
CREATE TABLE public.approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  name text NOT NULL,
  module text NOT NULL,
  entity_type text NOT NULL,
  min_amount numeric(18,2),
  max_amount numeric(18,2),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);
CREATE INDEX idx_wf_coop ON public.approval_workflows(cooperative_id);

CREATE TABLE public.approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
  step_order int NOT NULL CHECK (step_order > 0),
  step_type public.approval_action_type NOT NULL,
  required_role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, step_order)
);

CREATE TABLE public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.approval_workflows(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  amount numeric(18,2),
  current_step int NOT NULL DEFAULT 1,
  status public.transaction_status NOT NULL DEFAULT 'SUBMITTED',
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE INDEX idx_ar_coop ON public.approval_requests(cooperative_id);

CREATE TABLE public.approval_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  action public.approval_action_type NOT NULL,
  acted_by uuid NOT NULL,
  step_order int,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, action, acted_by)
);

-- segregation of duties: same user cannot both submit and check/approve
CREATE OR REPLACE FUNCTION public.enforce_segregation_of_duties()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE requester uuid;
BEGIN
  SELECT requested_by INTO requester FROM public.approval_requests WHERE id = NEW.request_id;
  IF NEW.action IN ('CHECK','APPROVE') AND requester = NEW.acted_by THEN
    RAISE EXCEPTION 'Segregation of duties: the maker cannot check or approve their own request.';
  END IF;
  IF NEW.action = 'APPROVE' AND EXISTS (
      SELECT 1 FROM public.approval_actions a
      WHERE a.request_id = NEW.request_id AND a.action = 'CHECK' AND a.acted_by = NEW.acted_by) THEN
    RAISE EXCEPTION 'Segregation of duties: the checker cannot also approve.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_sod BEFORE INSERT ON public.approval_actions
FOR EACH ROW EXECUTE FUNCTION public.enforce_segregation_of_duties();

-- ============ AUDIT ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  cooperative_id uuid REFERENCES public.cooperatives(id) ON DELETE SET NULL,
  action text NOT NULL,
  module text,
  entity_type text,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_coop ON public.audit_logs(cooperative_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE coop uuid;
BEGIN
  BEGIN
    coop := COALESCE(
      (to_jsonb(COALESCE(NEW, OLD)) ->> 'cooperative_id')::uuid,
      CASE WHEN TG_TABLE_NAME = 'cooperatives' THEN (to_jsonb(COALESCE(NEW, OLD)) ->> 'id')::uuid END
    );
  EXCEPTION WHEN others THEN coop := NULL; END;
  INSERT INTO public.audit_logs(user_id, cooperative_id, action, module, entity_type, entity_id, old_values, new_values)
  VALUES (
    auth.uid(), coop, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME,
    (to_jsonb(COALESCE(NEW, OLD)) ->> 'id')::uuid,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_audit_cooperatives AFTER INSERT OR UPDATE OR DELETE ON public.cooperatives
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_audit_rules AFTER INSERT OR UPDATE OR DELETE ON public.cooperative_rules
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_audit_members AFTER INSERT OR UPDATE OR DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_audit_tx AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_audit_periods AFTER INSERT OR UPDATE OR DELETE ON public.accounting_periods
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- updated_at triggers
CREATE TRIGGER t1 BEFORE UPDATE ON public.cooperatives FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t2 BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t3 BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t4 BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t5 BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t6 BEFORE UPDATE ON public.cooperative_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t7 BEFORE UPDATE ON public.chart_of_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t8 BEFORE UPDATE ON public.accounting_periods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t9 BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t10 BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t11 BEFORE UPDATE ON public.approval_workflows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t12 BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- profile auto-creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cooperatives, public.branches, public.profiles,
  public.roles, public.role_permissions, public.user_roles, public.members, public.cooperative_rules,
  public.chart_of_accounts, public.accounting_periods, public.transactions, public.journal_entries,
  public.journal_lines, public.approval_workflows, public.approval_steps, public.approval_requests,
  public.approval_actions TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.cooperatives, public.branches, public.profiles, public.permissions,
  public.roles, public.role_permissions, public.user_roles, public.members, public.cooperative_rules,
  public.chart_of_accounts, public.accounting_periods, public.transactions, public.journal_entries,
  public.journal_lines, public.approval_workflows, public.approval_steps, public.approval_requests,
  public.approval_actions, public.audit_logs TO service_role;

-- ============ RLS ============
ALTER TABLE public.cooperatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- cooperatives
CREATE POLICY coop_select ON public.cooperatives FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(id));
CREATE POLICY coop_insert ON public.cooperatives FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());
CREATE POLICY coop_update ON public.cooperatives FOR UPDATE TO authenticated
  USING (public.can_admin_cooperative(id)) WITH CHECK (public.can_admin_cooperative(id));
CREATE POLICY coop_delete ON public.cooperatives FOR DELETE TO authenticated
  USING (public.is_platform_admin());

-- profiles
CREATE POLICY profiles_self ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles a JOIN public.user_roles b ON a.cooperative_id = b.cooperative_id
    WHERE a.user_id = auth.uid() AND b.user_id = public.profiles.id AND a.cooperative_id IS NOT NULL));
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_platform_admin())
  WITH CHECK (id = auth.uid() OR public.is_platform_admin());
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_platform_admin());

-- permissions catalogue is readable by all signed-in users
CREATE POLICY permissions_read ON public.permissions FOR SELECT TO authenticated USING (true);

-- roles
CREATE POLICY roles_select ON public.roles FOR SELECT TO authenticated
  USING (cooperative_id IS NULL OR public.is_member_of_cooperative(cooperative_id));
CREATE POLICY roles_write ON public.roles FOR ALL TO authenticated
  USING (cooperative_id IS NOT NULL AND public.can_admin_cooperative(cooperative_id) OR public.is_platform_admin())
  WITH CHECK (cooperative_id IS NOT NULL AND public.can_admin_cooperative(cooperative_id) OR public.is_platform_admin());

CREATE POLICY role_perms_select ON public.role_permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id
    AND (r.cooperative_id IS NULL OR public.is_member_of_cooperative(r.cooperative_id))));
CREATE POLICY role_perms_write ON public.role_permissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id
    AND (public.is_platform_admin() OR (r.cooperative_id IS NOT NULL AND public.can_admin_cooperative(r.cooperative_id)))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id
    AND (public.is_platform_admin() OR (r.cooperative_id IS NOT NULL AND public.can_admin_cooperative(r.cooperative_id)))));

-- user_roles
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin()
     OR (cooperative_id IS NOT NULL AND public.is_member_of_cooperative(cooperative_id)));
CREATE POLICY user_roles_write ON public.user_roles FOR ALL TO authenticated
  USING (public.is_platform_admin() OR (cooperative_id IS NOT NULL AND public.can_admin_cooperative(cooperative_id)))
  WITH CHECK (public.is_platform_admin() OR (cooperative_id IS NOT NULL AND public.can_admin_cooperative(cooperative_id)));

-- generic tenant tables
CREATE POLICY branches_all ON public.branches FOR ALL TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id))
  WITH CHECK (public.can_admin_cooperative(cooperative_id));
CREATE POLICY members_select ON public.members FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id) OR user_id = auth.uid());
CREATE POLICY members_write ON public.members FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'members.edit'))
  WITH CHECK (public.has_permission(cooperative_id, 'members.edit'));
CREATE POLICY rules_select ON public.cooperative_rules FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id));
CREATE POLICY rules_write ON public.cooperative_rules FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'settings.edit'))
  WITH CHECK (public.has_permission(cooperative_id, 'settings.edit'));
CREATE POLICY coa_select ON public.chart_of_accounts FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id));
CREATE POLICY coa_write ON public.chart_of_accounts FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'accounting.edit'))
  WITH CHECK (public.has_permission(cooperative_id, 'accounting.edit'));
CREATE POLICY periods_select ON public.accounting_periods FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id));
CREATE POLICY periods_write ON public.accounting_periods FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'accounting.edit'))
  WITH CHECK (public.has_permission(cooperative_id, 'accounting.edit'));

CREATE POLICY tx_select ON public.transactions FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id)
     OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.user_id = auth.uid()));
CREATE POLICY tx_insert ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(cooperative_id, 'savings.post'));
CREATE POLICY tx_update ON public.transactions FOR UPDATE TO authenticated
  USING (public.has_permission(cooperative_id, 'savings.post'))
  WITH CHECK (public.has_permission(cooperative_id, 'savings.post'));

CREATE POLICY je_select ON public.journal_entries FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id));
CREATE POLICY je_write ON public.journal_entries FOR ALL TO authenticated
  USING (public.has_permission(cooperative_id, 'accounting.post'))
  WITH CHECK (public.has_permission(cooperative_id, 'accounting.post'));
CREATE POLICY jl_select ON public.journal_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_entries j WHERE j.id = journal_id
    AND public.is_member_of_cooperative(j.cooperative_id)));
CREATE POLICY jl_write ON public.journal_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_entries j WHERE j.id = journal_id
    AND public.has_permission(j.cooperative_id, 'accounting.post')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.journal_entries j WHERE j.id = journal_id
    AND public.has_permission(j.cooperative_id, 'accounting.post')));

CREATE POLICY wf_select ON public.approval_workflows FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id));
CREATE POLICY wf_write ON public.approval_workflows FOR ALL TO authenticated
  USING (public.can_admin_cooperative(cooperative_id))
  WITH CHECK (public.can_admin_cooperative(cooperative_id));
CREATE POLICY steps_select ON public.approval_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.approval_workflows w WHERE w.id = workflow_id
    AND public.is_member_of_cooperative(w.cooperative_id)));
CREATE POLICY steps_write ON public.approval_steps FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.approval_workflows w WHERE w.id = workflow_id
    AND public.can_admin_cooperative(w.cooperative_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.approval_workflows w WHERE w.id = workflow_id
    AND public.can_admin_cooperative(w.cooperative_id)));
CREATE POLICY ar_select ON public.approval_requests FOR SELECT TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id));
CREATE POLICY ar_write ON public.approval_requests FOR ALL TO authenticated
  USING (public.is_member_of_cooperative(cooperative_id))
  WITH CHECK (public.is_member_of_cooperative(cooperative_id));
CREATE POLICY aa_select ON public.approval_actions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.approval_requests r WHERE r.id = request_id
    AND public.is_member_of_cooperative(r.cooperative_id)));
CREATE POLICY aa_insert ON public.approval_actions FOR INSERT TO authenticated
  WITH CHECK (acted_by = auth.uid() AND EXISTS (SELECT 1 FROM public.approval_requests r
    WHERE r.id = request_id AND public.is_member_of_cooperative(r.cooperative_id)));

-- audit logs: readable by auditors/admins, never editable
CREATE POLICY audit_select ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_platform_admin()
     OR (cooperative_id IS NOT NULL AND public.has_permission(cooperative_id, 'administration.audit')));
CREATE POLICY audit_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
