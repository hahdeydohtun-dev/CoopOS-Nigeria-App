-- ENUMS
create type public.member_lifecycle_status as enum (
  'PROSPECTIVE','PENDING_VERIFICATION','PENDING_APPROVAL','ACTIVE','SUSPENDED','DORMANT',
  'REACTIVATION_PENDING','RETIRED','EXIT_PENDING','EXITED','DECEASED','BLACKLISTED');

create type public.employment_status_type as enum ('EMPLOYED','RETIRED','RESIGNED','TERMINATED','DECEASED','SELF_EMPLOYED','OTHER');
create type public.member_document_status as enum ('UPLOADED','UNDER_REVIEW','VERIFIED','REJECTED','EXPIRED');
create type public.bank_change_status as enum ('PENDING','APPROVED','REJECTED');
create type public.member_note_category as enum ('GENERAL','MEMBERSHIP','COMPLIANCE','EMPLOYMENT','LOAN','PAYROLL','OTHER');
create type public.member_verification_action as enum ('VERIFY','REQUEST_CORRECTION','REJECT','ESCALATE');

-- MEMBERS EXTENSION
alter table public.members
  add column if not exists member_number text,
  add column if not exists title text,
  add column if not exists middle_name text,
  add column if not exists preferred_name text,
  add column if not exists marital_status text,
  add column if not exists residential_address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text not null default 'Nigeria',
  add column if not exists nationality text,
  add column if not exists profile_photo_url text,
  add column if not exists exit_date date,
  add column if not exists lifecycle_status public.member_lifecycle_status not null default 'PROSPECTIVE';

update public.members set member_number = membership_number where member_number is null;
update public.members set lifecycle_status = case status
  when 'ACTIVE' then 'ACTIVE'::public.member_lifecycle_status
  when 'PENDING' then 'PENDING_APPROVAL'::public.member_lifecycle_status
  when 'DORMANT' then 'DORMANT'::public.member_lifecycle_status
  when 'EXITED' then 'EXITED'::public.member_lifecycle_status
  when 'SUSPENDED' then 'SUSPENDED'::public.member_lifecycle_status
  else 'PROSPECTIVE'::public.member_lifecycle_status end;

create unique index if not exists members_coop_member_number_key
  on public.members (cooperative_id, member_number) where member_number is not null;

-- MEMBERSHIP CATEGORIES
create table public.membership_categories (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (cooperative_id, code)
);
grant select, insert, update, delete on public.membership_categories to authenticated;
grant all on public.membership_categories to service_role;
alter table public.membership_categories enable row level security;
create policy "categories readable in cooperative" on public.membership_categories for select to authenticated
  using (public.is_member_of_cooperative(cooperative_id, auth.uid()) or public.is_platform_admin(auth.uid()));
create policy "categories managed by admins" on public.membership_categories for all to authenticated
  using (public.can_admin_cooperative(cooperative_id, auth.uid()))
  with check (public.can_admin_cooperative(cooperative_id, auth.uid()));

insert into public.membership_categories (cooperative_id, code, name, sort_order)
select c.id, v.code, v.name, v.ord
from public.cooperatives c
cross join (values
  ('JUNIOR_STAFF','Junior Staff',1),('SENIOR_STAFF','Senior Staff',2),('MANAGEMENT','Management',3),
  ('RETIREE','Retiree',4),('PENSIONER','Pensioner',5),('OTHER','Other',6)) as v(code,name,ord)
on conflict do nothing;

-- MEMBERSHIPS
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  membership_type text not null default 'STANDARD',
  membership_number text,
  category_id uuid references public.membership_categories(id),
  application_date date not null default current_date,
  approval_date date,
  effective_date date,
  status public.member_lifecycle_status not null default 'PROSPECTIVE',
  branch_id uuid references public.branches(id),
  department text,
  employee_id text,
  exit_date date,
  exit_reason text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create unique index memberships_coop_number_key on public.memberships (cooperative_id, membership_number) where membership_number is not null;
grant select, insert, update, delete on public.memberships to authenticated;
grant all on public.memberships to service_role;
alter table public.memberships enable row level security;
create policy "memberships visible to owner and staff" on public.memberships for select to authenticated
  using (
    exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid())
    or public.has_permission(cooperative_id, 'members.view', auth.uid())
    or public.can_admin_cooperative(cooperative_id, auth.uid())
  );
create policy "memberships managed by staff" on public.memberships for all to authenticated
  using (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()))
  with check (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()));

-- EMPLOYMENT
create table public.member_employment (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  employer_name text,
  employer_type text,
  department text,
  designation text,
  employee_id text,
  grade_level text,
  employment_type text,
  employment_status public.employment_status_type not null default 'EMPLOYED',
  date_employed date,
  retirement_date date,
  monthly_salary numeric,
  basic_salary numeric,
  net_salary numeric,
  payroll_frequency text,
  payroll_provider text,
  salary_bank text,
  salary_account text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create unique index member_employment_member_key on public.member_employment (member_id);
grant select, insert, update, delete on public.member_employment to authenticated;
grant all on public.member_employment to service_role;
alter table public.member_employment enable row level security;
create policy "employment visible to owner and staff" on public.member_employment for select to authenticated
  using (
    exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid())
    or public.has_permission(cooperative_id, 'members.view', auth.uid())
    or public.can_admin_cooperative(cooperative_id, auth.uid())
  );
create policy "employment managed by staff" on public.member_employment for all to authenticated
  using (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()))
  with check (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()));

-- BANK ACCOUNTS
create table public.member_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  bank_name text not null,
  bank_code text,
  account_number text not null,
  account_name text not null,
  account_type text,
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  verified_by uuid,
  verified_at timestamptz,
  change_status public.bank_change_status not null default 'PENDING',
  change_reason text,
  approved_by uuid,
  approved_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
grant select, insert, update, delete on public.member_bank_accounts to authenticated;
grant all on public.member_bank_accounts to service_role;
alter table public.member_bank_accounts enable row level security;
create policy "bank accounts visible to owner and staff" on public.member_bank_accounts for select to authenticated
  using (
    exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid())
    or public.has_permission(cooperative_id, 'members.view', auth.uid())
    or public.can_admin_cooperative(cooperative_id, auth.uid())
  );
create policy "members can request bank accounts" on public.member_bank_accounts for insert to authenticated
  with check (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()) and change_status = 'PENDING');
create policy "bank accounts managed by staff" on public.member_bank_accounts for all to authenticated
  using (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()))
  with check (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()));

-- NEXT OF KIN
create table public.member_next_of_kin (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  name text not null,
  relationship text,
  phone text,
  email text,
  address text,
  percentage numeric not null default 100,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
grant select, insert, update, delete on public.member_next_of_kin to authenticated;
grant all on public.member_next_of_kin to service_role;
alter table public.member_next_of_kin enable row level security;
create policy "kin visible to owner and staff" on public.member_next_of_kin for select to authenticated
  using (
    exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid())
    or public.has_permission(cooperative_id, 'members.view', auth.uid())
    or public.can_admin_cooperative(cooperative_id, auth.uid())
  );
create policy "kin managed by owner" on public.member_next_of_kin for all to authenticated
  using (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()));
create policy "kin managed by staff" on public.member_next_of_kin for all to authenticated
  using (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()))
  with check (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()));

-- DOCUMENTS
create table public.member_documents (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size integer,
  status public.member_document_status not null default 'UPLOADED',
  rejection_reason text,
  verified_by uuid,
  verified_at timestamptz,
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
grant select, insert, update, delete on public.member_documents to authenticated;
grant all on public.member_documents to service_role;
alter table public.member_documents enable row level security;
create policy "documents visible to owner and staff" on public.member_documents for select to authenticated
  using (
    exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid())
    or public.has_permission(cooperative_id, 'members.view', auth.uid())
    or public.can_admin_cooperative(cooperative_id, auth.uid())
  );
create policy "documents uploaded by owner" on public.member_documents for insert to authenticated
  with check (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()));
create policy "documents managed by staff" on public.member_documents for all to authenticated
  using (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()))
  with check (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()));

-- IDENTIFIERS
create table public.member_identifiers (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  identifier_type text not null,
  identifier_value text not null,
  issued_date date,
  expiry_date date,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
grant select, insert, update, delete on public.member_identifiers to authenticated;
grant all on public.member_identifiers to service_role;
alter table public.member_identifiers enable row level security;
create policy "identifiers visible to owner and staff" on public.member_identifiers for select to authenticated
  using (
    exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid())
    or public.has_permission(cooperative_id, 'members.view', auth.uid())
    or public.can_admin_cooperative(cooperative_id, auth.uid())
  );
create policy "identifiers managed by staff" on public.member_identifiers for all to authenticated
  using (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()))
  with check (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()));

-- STATUS HISTORY
create table public.member_status_history (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete cascade,
  previous_status public.member_lifecycle_status,
  new_status public.member_lifecycle_status not null,
  reason text,
  effective_date date not null default current_date,
  changed_by uuid,
  approved_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.member_status_history to authenticated;
grant all on public.member_status_history to service_role;
alter table public.member_status_history enable row level security;
create policy "status history visible to owner and staff" on public.member_status_history for select to authenticated
  using (
    exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid())
    or public.has_permission(cooperative_id, 'members.view', auth.uid())
    or public.can_admin_cooperative(cooperative_id, auth.uid())
  );

-- NOTES (staff only)
create table public.member_notes (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  category public.member_note_category not null default 'GENERAL',
  note text not null,
  member_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
grant select, insert, update, delete on public.member_notes to authenticated;
grant all on public.member_notes to service_role;
alter table public.member_notes enable row level security;
create policy "notes visible to staff" on public.member_notes for select to authenticated
  using (
    public.has_permission(cooperative_id, 'members.view', auth.uid())
    or public.can_admin_cooperative(cooperative_id, auth.uid())
    or (member_visible and exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()))
  );
create policy "notes managed by staff" on public.member_notes for all to authenticated
  using (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()))
  with check (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()));

-- VERIFICATION / CORRECTION REQUESTS
create table public.member_verifications (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete cascade,
  action public.member_verification_action not null,
  reason text,
  fields_requiring_correction text[],
  resolved boolean not null default false,
  resolved_at timestamptz,
  requested_by uuid,
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.member_verifications to authenticated;
grant all on public.member_verifications to service_role;
alter table public.member_verifications enable row level security;
create policy "verifications visible to owner and staff" on public.member_verifications for select to authenticated
  using (
    exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid())
    or public.has_permission(cooperative_id, 'members.view', auth.uid())
    or public.can_admin_cooperative(cooperative_id, auth.uid())
  );
create policy "verifications managed by staff" on public.member_verifications for all to authenticated
  using (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()))
  with check (public.has_permission(cooperative_id, 'members.manage', auth.uid()) or public.can_admin_cooperative(cooperative_id, auth.uid()));

-- NOTIFICATION EVENTS
create table public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on public.member_notifications to authenticated;
grant all on public.member_notifications to service_role;
alter table public.member_notifications enable row level security;
create policy "notifications visible to owner and staff" on public.member_notifications for select to authenticated
  using (
    exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid())
    or public.has_permission(cooperative_id, 'members.view', auth.uid())
    or public.can_admin_cooperative(cooperative_id, auth.uid())
  );
create policy "notifications updated by owner" on public.member_notifications for update to authenticated
  using (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()));

-- UPDATED_AT TRIGGERS
create trigger set_updated_at_membership_categories before update on public.membership_categories for each row execute function public.set_updated_at();
create trigger set_updated_at_memberships before update on public.memberships for each row execute function public.set_updated_at();
create trigger set_updated_at_member_employment before update on public.member_employment for each row execute function public.set_updated_at();
create trigger set_updated_at_member_bank_accounts before update on public.member_bank_accounts for each row execute function public.set_updated_at();
create trigger set_updated_at_member_next_of_kin before update on public.member_next_of_kin for each row execute function public.set_updated_at();
create trigger set_updated_at_member_documents before update on public.member_documents for each row execute function public.set_updated_at();
create trigger set_updated_at_member_identifiers before update on public.member_identifiers for each row execute function public.set_updated_at();
create trigger set_updated_at_member_notes before update on public.member_notes for each row execute function public.set_updated_at();
create trigger set_updated_at_member_verifications before update on public.member_verifications for each row execute function public.set_updated_at();

-- AUDIT TRIGGERS
create trigger audit_memberships after insert or update or delete on public.memberships for each row execute function public.log_audit_event();
create trigger audit_member_bank_accounts after insert or update or delete on public.member_bank_accounts for each row execute function public.log_audit_event();
create trigger audit_member_documents after insert or update or delete on public.member_documents for each row execute function public.log_audit_event();
create trigger audit_member_employment after insert or update or delete on public.member_employment for each row execute function public.log_audit_event();

-- NEXT OF KIN PERCENTAGE VALIDATION
create or replace function public.validate_next_of_kin_percentage()
returns trigger language plpgsql security definer set search_path = public as $$
declare total numeric;
begin
  select coalesce(sum(percentage),0) into total from public.member_next_of_kin
   where member_id = new.member_id and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  if total + coalesce(new.percentage,0) > 100 then
    raise exception 'Next of kin allocation cannot exceed 100%%';
  end if;
  return new;
end $$;
create trigger validate_nok_percentage before insert or update on public.member_next_of_kin
  for each row execute function public.validate_next_of_kin_percentage();

-- MEMBER NUMBER GENERATION
create or replace function public.next_member_number(_cooperative_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare fmt text; seq int; candidate text; pad int;
begin
  select text_value into fmt from public.cooperative_rules
   where cooperative_id = _cooperative_id and rule_key = 'member_number_format' and active limit 1;
  fmt := coalesce(fmt, 'COOP-{000000}');
  pad := coalesce(length(substring(fmt from '\{(0+)\}')), 6);
  select count(*) + 1 into seq from public.members where cooperative_id = _cooperative_id;
  loop
    candidate := regexp_replace(fmt, '\{0+\}', lpad(seq::text, pad, '0'));
    exit when not exists (select 1 from public.members where cooperative_id = _cooperative_id and member_number = candidate);
    seq := seq + 1;
  end loop;
  return candidate;
end $$;

-- CONTROLLED STATUS TRANSITIONS
create or replace function public.member_status_transition_allowed(_from public.member_lifecycle_status, _to public.member_lifecycle_status)
returns boolean language sql immutable as $$
  select case
    when _from = _to then false
    when _to in ('DECEASED','BLACKLISTED') then true
    when _from = 'PROSPECTIVE' then _to in ('PENDING_VERIFICATION','EXITED')
    when _from = 'PENDING_VERIFICATION' then _to in ('PENDING_APPROVAL','PROSPECTIVE','EXITED')
    when _from = 'PENDING_APPROVAL' then _to in ('ACTIVE','PENDING_VERIFICATION','EXITED')
    when _from = 'ACTIVE' then _to in ('SUSPENDED','DORMANT','RETIRED','EXIT_PENDING')
    when _from = 'SUSPENDED' then _to in ('ACTIVE','EXIT_PENDING','DORMANT')
    when _from = 'DORMANT' then _to in ('REACTIVATION_PENDING','EXIT_PENDING')
    when _from = 'REACTIVATION_PENDING' then _to in ('ACTIVE','DORMANT')
    when _from = 'RETIRED' then _to in ('EXIT_PENDING','ACTIVE')
    when _from = 'EXIT_PENDING' then _to in ('EXITED','ACTIVE')
    else false end
$$;

create or replace function public.change_member_status(
  _member_id uuid,
  _new_status public.member_lifecycle_status,
  _reason text default null,
  _effective_date date default current_date
) returns public.member_lifecycle_status
language plpgsql security definer set search_path = public as $$
declare _coop uuid; _current public.member_lifecycle_status; _membership uuid;
begin
  select cooperative_id, lifecycle_status into _coop, _current from public.members where id = _member_id;
  if _coop is null then raise exception 'Member not found'; end if;
  if not (public.has_permission(_coop, 'members.manage', auth.uid()) or public.can_admin_cooperative(_coop, auth.uid())) then
    raise exception 'You are not allowed to change membership status';
  end if;
  if not public.member_status_transition_allowed(_current, _new_status) then
    raise exception 'Cannot move a member from % to %', _current, _new_status;
  end if;
  if _reason is null or length(btrim(_reason)) = 0 then
    raise exception 'A reason is required for every status change';
  end if;

  select id into _membership from public.memberships where member_id = _member_id order by created_at desc limit 1;

  update public.members
     set lifecycle_status = _new_status,
         exit_date = case when _new_status = 'EXITED' then _effective_date else exit_date end,
         status = case _new_status
            when 'ACTIVE' then 'ACTIVE'::public.member_status
            when 'SUSPENDED' then 'SUSPENDED'::public.member_status
            when 'DORMANT' then 'DORMANT'::public.member_status
            when 'EXITED' then 'EXITED'::public.member_status
            else 'PENDING'::public.member_status end,
         updated_by = auth.uid()
   where id = _member_id;

  if _membership is not null then
    update public.memberships
       set status = _new_status,
           approval_date = case when _new_status = 'ACTIVE' and approval_date is null then _effective_date else approval_date end,
           effective_date = case when _new_status = 'ACTIVE' and effective_date is null then _effective_date else effective_date end,
           exit_date = case when _new_status = 'EXITED' then _effective_date else exit_date end,
           exit_reason = case when _new_status in ('EXIT_PENDING','EXITED') then _reason else exit_reason end,
           updated_by = auth.uid()
     where id = _membership;
  end if;

  insert into public.member_status_history
    (cooperative_id, member_id, membership_id, previous_status, new_status, reason, effective_date, changed_by)
  values (_coop, _member_id, _membership, _current, _new_status, _reason, _effective_date, auth.uid());

  insert into public.member_notifications (cooperative_id, member_id, event_type, title, body)
  values (_coop, _member_id, 'MEMBER_STATUS_CHANGED', 'Membership status updated', 'Status changed to ' || _new_status || '.');

  return _new_status;
end $$;

revoke all on function public.change_member_status(uuid, public.member_lifecycle_status, text, date) from public, anon;
grant execute on function public.change_member_status(uuid, public.member_lifecycle_status, text, date) to authenticated;
revoke all on function public.next_member_number(uuid) from public, anon;
grant execute on function public.next_member_number(uuid) to authenticated;
revoke all on function public.member_status_transition_allowed(public.member_lifecycle_status, public.member_lifecycle_status) from public, anon;
grant execute on function public.member_status_transition_allowed(public.member_lifecycle_status, public.member_lifecycle_status) to authenticated;