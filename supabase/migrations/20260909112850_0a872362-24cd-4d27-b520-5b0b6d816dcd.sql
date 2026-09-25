
-- 1. Security: stop signed-out visitors from calling internal helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_admin_cooperative(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_member_of_cooperative(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_journal_posting_rules() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_posted_transaction_immutability() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_segregation_of_duties() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_posted_journal_lines() FROM anon, authenticated;

-- 2. Permission catalogue
INSERT INTO public.permissions (code, module, resource, action, description) VALUES
  ('members.view','members','members','VIEW','View member records'),
  ('members.create','members','members','CREATE','Register new members'),
  ('members.edit','members','members','EDIT','Edit member records'),
  ('members.approve','members','members','APPROVE','Approve membership applications'),
  ('members.export','members','members','EXPORT','Export member data'),
  ('savings.view','savings','savings','VIEW','View savings balances and history'),
  ('savings.post','savings','savings','POST','Post savings transactions'),
  ('savings.approve','savings','savings','APPROVE','Approve savings transactions'),
  ('savings.export','savings','savings','EXPORT','Export savings data'),
  ('checkoff.view','checkoff','schedules','VIEW','View check-off schedules'),
  ('checkoff.post','checkoff','schedules','POST','Post check-off schedules'),
  ('loans.view','loans','loans','VIEW','View loans'),
  ('loans.create','loans','loans','CREATE','Create loan applications'),
  ('loans.approve','loans','loans','APPROVE','Approve loans'),
  ('loans.disburse','loans','loans','APPROVE','Disburse approved loans'),
  ('repayments.view','repayments','repayments','VIEW','View loan repayments'),
  ('repayments.post','repayments','repayments','POST','Post loan repayments'),
  ('withdrawals.view','withdrawals','withdrawals','VIEW','View withdrawal requests'),
  ('withdrawals.create','withdrawals','withdrawals','CREATE','Raise withdrawal requests'),
  ('withdrawals.approve','withdrawals','withdrawals','APPROVE','Approve withdrawal requests'),
  ('accounting.view','accounting','ledger','VIEW','View ledgers and journals'),
  ('accounting.edit','accounting','ledger','EDIT','Maintain chart of accounts and periods'),
  ('accounting.post','accounting','ledger','POST','Post journal entries'),
  ('accounting.reverse','accounting','ledger','REVERSE','Reverse posted entries'),
  ('accounting.export','accounting','ledger','EXPORT','Export accounting data'),
  ('banking.view','banking','accounts','VIEW','View bank accounts'),
  ('banking.edit','banking','accounts','EDIT','Maintain bank accounts'),
  ('treasury.view','treasury','treasury','VIEW','View treasury positions'),
  ('treasury.edit','treasury','treasury','EDIT','Maintain treasury positions'),
  ('reports.view','reports','reports','VIEW','View reports'),
  ('reports.export','reports','reports','EXPORT','Export reports'),
  ('governance.view','governance','governance','VIEW','View governance records'),
  ('governance.edit','governance','governance','EDIT','Maintain governance records'),
  ('settings.view','settings','settings','VIEW','View cooperative settings and rules'),
  ('settings.edit','settings','settings','EDIT','Edit cooperative settings and rules'),
  ('administration.users','administration','users','EDIT','Manage users and access'),
  ('administration.roles','administration','roles','EDIT','Manage roles and permissions'),
  ('administration.audit','administration','audit','VIEW','View audit trail'),
  ('administration.security','administration','security','VIEW','View security settings')
ON CONFLICT (code) DO NOTHING;

-- 3. Built-in system roles (global: available to every cooperative)
INSERT INTO public.roles (cooperative_id, key, name, description, is_platform_role, is_system) VALUES
  (NULL,'PLATFORM_SUPER_ADMIN','Platform Super Admin','Full platform administration',true,true),
  (NULL,'PLATFORM_SUPPORT','Platform Support','Platform support access',true,true),
  (NULL,'PLATFORM_AUDITOR','Platform Auditor','Read-only platform audit access',true,true),
  (NULL,'COOPERATIVE_ADMIN','Cooperative Admin','Full administration of one cooperative',false,true),
  (NULL,'COOPERATIVE_MANAGER','Cooperative Manager','Day-to-day management oversight',false,true),
  (NULL,'TREASURER','Treasurer','Savings, withdrawals, banking and treasury',false,true),
  (NULL,'ACCOUNTANT','Accountant','Accounting and reporting',false,true),
  (NULL,'LOAN_OFFICER','Loan Officer','Loan origination and repayments',false,true),
  (NULL,'CHECKER','Checker','Second-line verification of transactions',false,true),
  (NULL,'APPROVER','Approver','Final approval of transactions',false,true),
  (NULL,'AUDITOR','Auditor','Read-only audit access',false,true),
  (NULL,'PAYROLL_OFFICER','Payroll Officer','Check-off and payroll schedules',false,true),
  (NULL,'SECRETARY','Secretary','Membership records and governance',false,true),
  (NULL,'COMMITTEE_MEMBER','Committee Member','Committee oversight, read-only',false,true),
  (NULL,'MEMBER','Member','Cooperative member portal access',false,true);

-- 4. Role -> permission mapping
WITH mapping(role_key, codes) AS (
  VALUES
    ('COOPERATIVE_ADMIN', ARRAY['members.view','members.create','members.edit','members.approve','members.export','savings.view','savings.post','savings.approve','savings.export','checkoff.view','checkoff.post','loans.view','loans.create','loans.approve','loans.disburse','repayments.view','repayments.post','withdrawals.view','withdrawals.create','withdrawals.approve','accounting.view','accounting.edit','accounting.post','accounting.reverse','accounting.export','banking.view','banking.edit','treasury.view','treasury.edit','reports.view','reports.export','governance.view','governance.edit','settings.view','settings.edit','administration.users','administration.roles','administration.audit','administration.security']),
    ('COOPERATIVE_MANAGER', ARRAY['members.view','members.approve','savings.view','savings.approve','checkoff.view','loans.view','loans.approve','repayments.view','withdrawals.view','withdrawals.approve','accounting.view','banking.view','treasury.view','reports.view','reports.export','governance.view','settings.view']),
    ('TREASURER', ARRAY['members.view','savings.view','savings.post','savings.export','withdrawals.view','withdrawals.create','withdrawals.approve','banking.view','banking.edit','treasury.view','treasury.edit','accounting.view','reports.view']),
    ('ACCOUNTANT', ARRAY['members.view','savings.view','accounting.view','accounting.edit','accounting.post','accounting.reverse','accounting.export','banking.view','reports.view','reports.export','settings.view']),
    ('LOAN_OFFICER', ARRAY['members.view','loans.view','loans.create','repayments.view','repayments.post','reports.view']),
    ('CHECKER', ARRAY['members.view','savings.view','loans.view','repayments.view','withdrawals.view','accounting.view','reports.view']),
    ('APPROVER', ARRAY['members.view','members.approve','savings.view','savings.approve','loans.view','loans.approve','loans.disburse','withdrawals.view','withdrawals.approve','accounting.view','reports.view']),
    ('AUDITOR', ARRAY['members.view','savings.view','checkoff.view','loans.view','repayments.view','withdrawals.view','accounting.view','accounting.export','banking.view','treasury.view','reports.view','reports.export','governance.view','settings.view','administration.audit']),
    ('PAYROLL_OFFICER', ARRAY['members.view','checkoff.view','checkoff.post','savings.view','reports.view']),
    ('SECRETARY', ARRAY['members.view','members.create','members.edit','governance.view','governance.edit','reports.view']),
    ('COMMITTEE_MEMBER', ARRAY['members.view','savings.view','loans.view','reports.view','governance.view'])
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM mapping m
JOIN public.roles r ON r.key = m.role_key::public.app_role AND r.cooperative_id IS NULL
JOIN public.permissions p ON p.code = ANY(m.codes)
ON CONFLICT DO NOTHING;

-- 5. Demo cooperative
INSERT INTO public.cooperatives (id, legal_name, trading_name, registration_number, cooperative_type, state, lga, address, phone, email, website, currency, financial_year_start, agm_date, status, primary_contact, is_demo)
VALUES ('11111111-1111-4111-8111-111111111111','Unity Staff Thrift & Credit Cooperative Society Ltd','Unity Coop','DEMO/LA/2019/0001','THRIFT_AND_CREDIT','Lagos','Ikeja','12 Obafemi Awolowo Way, Ikeja, Lagos','+234 801 000 0001','info@unitycoop.demo','https://unitycoop.demo','NGN','2026-01-01','2026-06-27','ACTIVE','Mrs. Adaeze Okonkwo', true);

INSERT INTO public.branches (id, cooperative_id, name, code, state, address, phone, is_demo) VALUES
  ('22222222-2222-4222-8222-222222222201','11111111-1111-4111-8111-111111111111','Head Office','HQ','Lagos','12 Obafemi Awolowo Way, Ikeja, Lagos','+234 801 000 0001', true),
  ('22222222-2222-4222-8222-222222222202','11111111-1111-4111-8111-111111111111','Abuja Branch','ABJ','FCT','5 Ademola Adetokunbo Crescent, Wuse II, Abuja','+234 801 000 0002', true);

INSERT INTO public.members (cooperative_id, branch_id, membership_number, first_name, last_name, gender, date_of_birth, phone, email, employer, staff_number, join_date, status, is_demo) VALUES
  ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222201','UC/0001','Adaeze','Okonkwo','F','1985-03-14','+234 802 111 0001','adaeze.okonkwo@demo.ng','Unity Holdings Plc','UH-1041','2019-04-02','ACTIVE',true),
  ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222201','UC/0002','Chukwuemeka','Eze','M','1979-11-02','+234 802 111 0002','emeka.eze@demo.ng','Unity Holdings Plc','UH-0876','2019-04-02','ACTIVE',true),
  ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222201','UC/0003','Fatima','Bello','F','1990-07-21','+234 802 111 0003','fatima.bello@demo.ng','Unity Holdings Plc','UH-1332','2020-01-15','ACTIVE',true),
  ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222201','UC/0004','Oluwaseun','Adeyemi','M','1988-02-09','+234 802 111 0004','seun.adeyemi@demo.ng','Unity Holdings Plc','UH-1477','2020-03-01','ACTIVE',true),
  ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222202','UC/0005','Ngozi','Nwachukwu','F','1993-05-30','+234 802 111 0005','ngozi.nwachukwu@demo.ng','Unity Holdings Plc','UH-1591','2021-02-11','ACTIVE',true),
  ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222202','UC/0006','Ibrahim','Musa','M','1982-09-17','+234 802 111 0006','ibrahim.musa@demo.ng','Unity Holdings Plc','UH-0623','2019-08-19','DORMANT',true),
  ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222202','UC/0007','Blessing','Etim','F','1995-12-05','+234 802 111 0007','blessing.etim@demo.ng','Unity Holdings Plc','UH-1720','2022-06-06','ACTIVE',true),
  ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222201','UC/0008','Tunde','Balogun','M','1975-01-28','+234 802 111 0008','tunde.balogun@demo.ng','Unity Holdings Plc','UH-0410','2019-04-02','ACTIVE',true),
  ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222201','UC/0009','Amina','Yusuf','F','1991-04-12','+234 802 111 0009','amina.yusuf@demo.ng','Unity Holdings Plc','UH-1655','2022-01-10','PENDING',true),
  ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222202','UC/0010','Peter','Obi','M','1986-10-23','+234 802 111 0010','peter.obi@demo.ng','Unity Holdings Plc','UH-1288','2020-09-14','ACTIVE',true);

-- 6. Starter chart of accounts
INSERT INTO public.chart_of_accounts (cooperative_id, code, name, account_type, is_active, description) VALUES
  ('11111111-1111-4111-8111-111111111111','1000','Cash at Bank','ASSET',true,'Operating bank balances'),
  ('11111111-1111-4111-8111-111111111111','1100','Cash in Hand','ASSET',true,'Petty cash'),
  ('11111111-1111-4111-8111-111111111111','1200','Loans to Members','ASSET',true,'Outstanding member loan principal'),
  ('11111111-1111-4111-8111-111111111111','1300','Interest Receivable','ASSET',true,'Accrued loan interest'),
  ('11111111-1111-4111-8111-111111111111','2000','Member Savings','LIABILITY',true,'Regular member savings deposits'),
  ('11111111-1111-4111-8111-111111111111','2100','Special Savings','LIABILITY',true,'Special/target savings deposits'),
  ('11111111-1111-4111-8111-111111111111','2200','Accounts Payable','LIABILITY',true,'Amounts owed by the cooperative'),
  ('11111111-1111-4111-8111-111111111111','3000','Member Shares','EQUITY',true,'Paid-up member share capital'),
  ('11111111-1111-4111-8111-111111111111','3100','Statutory Reserve','EQUITY',true,'Statutory reserve fund'),
  ('11111111-1111-4111-8111-111111111111','3200','Retained Surplus','EQUITY',true,'Accumulated undistributed surplus'),
  ('11111111-1111-4111-8111-111111111111','4000','Loan Interest Income','INCOME',true,'Interest earned on member loans'),
  ('11111111-1111-4111-8111-111111111111','4100','Fees and Charges','INCOME',true,'Processing and administrative fees'),
  ('11111111-1111-4111-8111-111111111111','5000','Administrative Expenses','EXPENSE',true,'General administrative running costs'),
  ('11111111-1111-4111-8111-111111111111','5100','Bank Charges','EXPENSE',true,'Bank and payment processing charges'),
  ('11111111-1111-4111-8111-111111111111','5200','AGM and Governance Expenses','EXPENSE',true,'Meetings, elections and governance costs');

-- 7. Accounting period
INSERT INTO public.accounting_periods (cooperative_id, name, start_date, end_date, status) VALUES
  ('11111111-1111-4111-8111-111111111111','FY2026',  '2026-01-01','2026-12-31','OPEN');

-- 8. Configurable cooperative rules
INSERT INTO public.cooperative_rules (cooperative_id, rule_key, rule_name, description, category, value_type, numeric_value, boolean_value, effective_from, active) VALUES
  ('11111111-1111-4111-8111-111111111111','minimum_monthly_contribution','Minimum monthly contribution','Least amount a member must contribute each month','SAVINGS','NUMERIC',10000,NULL,'2026-01-01',true),
  ('11111111-1111-4111-8111-111111111111','minimum_membership_months_for_loan','Minimum membership months before a loan','Months of membership required before a loan application','LOANS','NUMERIC',6,NULL,'2026-01-01',true),
  ('11111111-1111-4111-8111-111111111111','normal_loan_multiplier','Normal loan multiplier','Multiple of savings allowed for a normal loan','LOANS','NUMERIC',2,NULL,'2026-01-01',true),
  ('11111111-1111-4111-8111-111111111111','special_loan_multiplier','Special loan multiplier','Multiple of savings allowed for a special loan','LOANS','NUMERIC',3,NULL,'2026-01-01',true),
  ('11111111-1111-4111-8111-111111111111','maximum_regular_withdrawal_percentage','Maximum regular withdrawal percentage','Share of savings a member may withdraw at once','WITHDRAWALS','NUMERIC',50,NULL,'2026-01-01',true),
  ('11111111-1111-4111-8111-111111111111','withdrawal_cooling_period_days','Withdrawal cooling period (days)','Days between successive withdrawals','WITHDRAWALS','NUMERIC',90,NULL,'2026-01-01',true),
  ('11111111-1111-4111-8111-111111111111','minimum_continuous_savings_months','Minimum continuous savings months','Unbroken months of savings required','SAVINGS','NUMERIC',6,NULL,'2026-01-01',true),
  ('11111111-1111-4111-8111-111111111111','special_savings_waiting_period','Special savings waiting period (months)','Waiting period before special savings can be accessed','SAVINGS','NUMERIC',12,NULL,'2026-01-01',true),
  ('11111111-1111-4111-8111-111111111111','guarantor_required','Guarantor required','Whether loans require guarantors','LOANS','BOOLEAN',NULL,true,'2026-01-01',true),
  ('11111111-1111-4111-8111-111111111111','loan_processing_fee','Loan processing fee (%)','Percentage of loan principal charged as a fee','LOANS','NUMERIC',1,NULL,'2026-01-01',true),
  ('11111111-1111-4111-8111-111111111111','default_penalty_rate','Default penalty rate (%)','Monthly penalty on overdue repayments','LOANS','NUMERIC',2,NULL,'2026-01-01',true);

-- 9. Approval workflow foundation
INSERT INTO public.approval_workflows (id, cooperative_id, name, module, entity_type, min_amount, max_amount, active) VALUES
  ('33333333-3333-4333-8333-333333333301','11111111-1111-4111-8111-111111111111','Standard financial transaction approval','accounting','transaction',0,NULL,true);

INSERT INTO public.approval_steps (workflow_id, step_order, step_type, required_role) VALUES
  ('33333333-3333-4333-8333-333333333301',1,'SUBMIT','ACCOUNTANT'),
  ('33333333-3333-4333-8333-333333333301',2,'CHECK','CHECKER'),
  ('33333333-3333-4333-8333-333333333301',3,'APPROVE','APPROVER');
