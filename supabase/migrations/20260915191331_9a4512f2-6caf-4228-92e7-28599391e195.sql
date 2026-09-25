CREATE OR REPLACE FUNCTION public.trial_balance(_cooperative_id uuid, _from date, _to date)
RETURNS TABLE (
  account_id uuid, code text, name text, account_type public.account_type,
  account_subtype text, normal_balance public.normal_balance,
  opening numeric, debit numeric, credit numeric, net numeric
) LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT a.id, a.code, a.name, a.account_type, a.account_subtype, a.normal_balance,
    COALESCE((SELECT SUM(l.debit - l.credit) FROM public.journal_lines l
              JOIN public.journal_entries j ON j.id = l.journal_id
             WHERE l.account_id = a.id AND j.status = 'POSTED' AND j.posting_date < _from), 0) AS opening,
    COALESCE((SELECT SUM(l.debit) FROM public.journal_lines l
              JOIN public.journal_entries j ON j.id = l.journal_id
             WHERE l.account_id = a.id AND j.status = 'POSTED' AND j.posting_date BETWEEN _from AND _to), 0) AS debit,
    COALESCE((SELECT SUM(l.credit) FROM public.journal_lines l
              JOIN public.journal_entries j ON j.id = l.journal_id
             WHERE l.account_id = a.id AND j.status = 'POSTED' AND j.posting_date BETWEEN _from AND _to), 0) AS credit,
    COALESCE((SELECT SUM(l.debit - l.credit) FROM public.journal_lines l
              JOIN public.journal_entries j ON j.id = l.journal_id
             WHERE l.account_id = a.id AND j.status = 'POSTED' AND j.posting_date <= _to), 0) AS net
  FROM public.chart_of_accounts a
  WHERE a.cooperative_id = _cooperative_id
  ORDER BY a.code;
$$;
GRANT EXECUTE ON FUNCTION public.trial_balance(uuid, date, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.trial_balance(uuid, date, date) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.account_ledger(_cooperative_id uuid, _account_id uuid, _from date, _to date, _limit integer DEFAULT 200)
RETURNS TABLE (
  line_id uuid, journal_id uuid, journal_number text, posting_date date, description text,
  reference text, source_type text, source_id uuid, member_id uuid, loan_id uuid,
  debit numeric, credit numeric, running_balance numeric
) LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH opening AS (
    SELECT COALESCE(SUM(l.debit - l.credit), 0) AS bal
      FROM public.journal_lines l JOIN public.journal_entries j ON j.id = l.journal_id
     WHERE l.account_id = _account_id AND j.cooperative_id = _cooperative_id
       AND j.status = 'POSTED' AND j.posting_date < _from
  ), rows AS (
    SELECT l.id, j.id AS jid, j.journal_number, j.posting_date, COALESCE(l.description, j.description) AS description,
           COALESCE(l.reference, j.reference) AS reference, j.source_type, j.source_id, l.member_id, l.loan_id,
           l.debit, l.credit,
           SUM(l.debit - l.credit) OVER (ORDER BY j.posting_date, j.journal_number, l.line_sequence
                                         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum
      FROM public.journal_lines l JOIN public.journal_entries j ON j.id = l.journal_id
     WHERE l.account_id = _account_id AND j.cooperative_id = _cooperative_id
       AND j.status = 'POSTED' AND j.posting_date BETWEEN _from AND _to
  )
  SELECT r.id, r.jid, r.journal_number, r.posting_date, r.description, r.reference, r.source_type, r.source_id,
         r.member_id, r.loan_id, r.debit, r.credit, (SELECT bal FROM opening) + r.cum
    FROM rows r
   ORDER BY r.posting_date, r.journal_number
   LIMIT _limit;
$$;
GRANT EXECUTE ON FUNCTION public.account_ledger(uuid, uuid, date, date, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.account_ledger(uuid, uuid, date, date, integer) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.subledger_reconciliation(_cooperative_id uuid, _as_of date)
RETURNS TABLE (subledger text, subledger_balance numeric, gl_balance numeric, difference numeric)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH gl AS (
    SELECT a.account_subtype, SUM(l.credit - l.debit) AS credit_bal, SUM(l.debit - l.credit) AS debit_bal
      FROM public.journal_lines l
      JOIN public.journal_entries j ON j.id = l.journal_id
      JOIN public.chart_of_accounts a ON a.id = l.account_id
     WHERE j.cooperative_id = _cooperative_id AND j.status = 'POSTED' AND j.posting_date <= _as_of
     GROUP BY a.account_subtype
  ),
  savings_sub AS (
    SELECT COALESCE(SUM(current_balance), 0) AS bal FROM public.member_savings_accounts
     WHERE cooperative_id = _cooperative_id
  ),
  loan_sub AS (
    SELECT COALESCE(SUM(outstanding_principal), 0) AS bal FROM public.loans
     WHERE cooperative_id = _cooperative_id
  )
  SELECT 'Member savings'::text,
         (SELECT bal FROM savings_sub),
         COALESCE((SELECT credit_bal FROM gl WHERE account_subtype = 'SAVINGS'), 0),
         (SELECT bal FROM savings_sub) - COALESCE((SELECT credit_bal FROM gl WHERE account_subtype = 'SAVINGS'), 0)
  UNION ALL
  SELECT 'Loans receivable'::text,
         (SELECT bal FROM loan_sub),
         COALESCE((SELECT debit_bal FROM gl WHERE account_subtype = 'LOANS'), 0),
         (SELECT bal FROM loan_sub) - COALESCE((SELECT debit_bal FROM gl WHERE account_subtype = 'LOANS'), 0);
$$;
GRANT EXECUTE ON FUNCTION public.subledger_reconciliation(uuid, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.subledger_reconciliation(uuid, date) FROM PUBLIC, anon;