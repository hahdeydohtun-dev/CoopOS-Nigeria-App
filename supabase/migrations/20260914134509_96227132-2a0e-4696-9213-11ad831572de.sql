
CREATE OR REPLACE FUNCTION public.run_loan_daily_maintenance(_as_of date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_loan record;
  v_grace int;
  v_npl int;
  v_rate numeric;
  v_basis text;
  v_arr record;
  v_dpd int;
  v_base numeric;
  v_penalty numeric;
  v_snapshots int := 0;
  v_penalties int := 0;
  v_notices int := 0;
  v_last_payment date;
BEGIN
  FOR v_loan IN
    SELECT l.id, l.cooperative_id, l.member_id, l.loan_number, l.loan_product_id,
           COALESCE(l.outstanding_principal,0) AS op,
           COALESCE(l.outstanding_interest,0) AS oi,
           COALESCE(l.outstanding_fees,0) AS of_,
           COALESCE(l.outstanding_penalties,0) AS opn,
           lp.penal_interest_rate
    FROM public.loans l
    LEFT JOIN public.loan_products lp ON lp.id = l.loan_product_id
    WHERE l.status IN ('ACTIVE','RESTRUCTURED','DEFAULTED')
  LOOP
    SELECT COALESCE(MAX(numeric_value)::int, 5) INTO v_grace
      FROM public.cooperative_rules
     WHERE cooperative_id = v_loan.cooperative_id AND rule_key = 'repayments.grace_days' AND active;
    SELECT COALESCE(MAX(numeric_value)::int, 90) INTO v_npl
      FROM public.cooperative_rules
     WHERE cooperative_id = v_loan.cooperative_id AND rule_key = 'repayments.npl_threshold_dpd' AND active;
    SELECT MAX(numeric_value) INTO v_rate
      FROM public.cooperative_rules
     WHERE cooperative_id = v_loan.cooperative_id AND rule_key = 'repayments.penalty_rate' AND active;
    v_rate := COALESCE(v_rate, v_loan.penal_interest_rate, 0);
    SELECT COALESCE(MAX(text_value), 'OVERDUE_AMOUNT') INTO v_basis
      FROM public.cooperative_rules
     WHERE cooperative_id = v_loan.cooperative_id AND rule_key = 'repayments.penalty_basis' AND active;

    SELECT
      COALESCE(SUM(GREATEST(sl.principal - sl.paid_principal, 0)), 0) AS principal_arrears,
      COALESCE(SUM(GREATEST(sl.interest  - sl.paid_interest , 0)), 0) AS interest_arrears,
      COALESCE(SUM(GREATEST(sl.fees      - sl.paid_fees     , 0)), 0) AS fee_arrears,
      MIN(sl.due_date) AS earliest
    INTO v_arr
    FROM public.loan_schedule_lines sl
    JOIN public.loan_schedules s ON s.id = sl.schedule_id
    WHERE s.loan_id = v_loan.id
      AND s.status = 'ACTIVE'
      AND sl.due_date < _as_of - v_grace
      AND (GREATEST(sl.principal - sl.paid_principal, 0)
         + GREATEST(sl.interest  - sl.paid_interest , 0)
         + GREATEST(sl.fees      - sl.paid_fees     , 0)) > 0.009;

    v_dpd := CASE WHEN v_arr.earliest IS NULL THEN 0 ELSE GREATEST(0, _as_of - v_arr.earliest) END;

    SELECT MAX(repayment_date) INTO v_last_payment
      FROM public.loan_repayments
     WHERE loan_id = v_loan.id AND status = 'POSTED';

    INSERT INTO public.loan_delinquency_snapshots (
      cooperative_id, loan_id, member_id, snapshot_date, days_past_due, maximum_days_past_due,
      earliest_overdue_date, last_payment_date,
      outstanding_principal, outstanding_interest, outstanding_fees, outstanding_penalties,
      principal_arrears, interest_arrears, fee_arrears, penalty_arrears, total_arrears,
      par_bucket, delinquency_status, npl, rule_used
    ) VALUES (
      v_loan.cooperative_id, v_loan.id, v_loan.member_id, _as_of, v_dpd, v_dpd,
      v_arr.earliest, v_last_payment,
      v_loan.op, v_loan.oi, v_loan.of_, v_loan.opn,
      v_arr.principal_arrears, v_arr.interest_arrears, v_arr.fee_arrears, v_loan.opn,
      v_arr.principal_arrears + v_arr.interest_arrears + v_arr.fee_arrears + v_loan.opn,
      CASE WHEN v_dpd >= 90 THEN 'PAR 90' WHEN v_dpd >= 60 THEN 'PAR 60'
           WHEN v_dpd >= 30 THEN 'PAR 30' WHEN v_dpd >= 1 THEN 'PAR 1' ELSE 'Current' END,
      CASE WHEN v_dpd = 0 THEN 'CURRENT' WHEN v_dpd >= v_npl THEN 'NON_PERFORMING' ELSE 'OVERDUE' END,
      v_dpd >= v_npl,
      format('grace %s days, non-performing from %s days', v_grace, v_npl)
    )
    ON CONFLICT (loan_id, snapshot_date) DO UPDATE SET
      days_past_due = EXCLUDED.days_past_due,
      maximum_days_past_due = GREATEST(loan_delinquency_snapshots.maximum_days_past_due, EXCLUDED.days_past_due),
      earliest_overdue_date = EXCLUDED.earliest_overdue_date,
      last_payment_date = EXCLUDED.last_payment_date,
      outstanding_principal = EXCLUDED.outstanding_principal,
      outstanding_interest = EXCLUDED.outstanding_interest,
      outstanding_fees = EXCLUDED.outstanding_fees,
      outstanding_penalties = EXCLUDED.outstanding_penalties,
      principal_arrears = EXCLUDED.principal_arrears,
      interest_arrears = EXCLUDED.interest_arrears,
      fee_arrears = EXCLUDED.fee_arrears,
      penalty_arrears = EXCLUDED.penalty_arrears,
      total_arrears = EXCLUDED.total_arrears,
      par_bucket = EXCLUDED.par_bucket,
      delinquency_status = EXCLUDED.delinquency_status,
      npl = EXCLUDED.npl,
      rule_used = EXCLUDED.rule_used;
    v_snapshots := v_snapshots + 1;

    -- Late payment charge: one day's accrual, never twice for the same day.
    IF v_dpd > 0 AND v_rate > 0 THEN
      v_base := CASE WHEN v_basis = 'OUTSTANDING_PRINCIPAL' THEN v_loan.op
                     ELSE v_arr.principal_arrears + v_arr.interest_arrears + v_arr.fee_arrears END;
      v_penalty := ROUND((v_base * (v_rate / 100.0) / 365.0)::numeric, 2);
      IF v_penalty > 0 AND NOT EXISTS (
        SELECT 1 FROM public.loan_transactions
         WHERE loan_id = v_loan.id
           AND transaction_type = 'PENALTY_CHARGE'
           AND transaction_date = _as_of
           AND status = 'POSTED'
      ) AND NOT EXISTS (
        SELECT 1 FROM public.accounting_periods
         WHERE cooperative_id = v_loan.cooperative_id
           AND _as_of BETWEEN start_date AND end_date
           AND status = 'CLOSED'
      ) THEN
        INSERT INTO public.loan_transactions (
          cooperative_id, loan_id, member_id, transaction_number, transaction_type, status,
          amount, principal_component, interest_component, fee_component, penalty_component,
          transaction_date, posting_date, reference, source, narration
        ) VALUES (
          v_loan.cooperative_id, v_loan.id, v_loan.member_id,
          v_loan.loan_number || '-PEN-' || to_char(_as_of, 'YYYYMMDD'),
          'PENALTY_CHARGE', 'POSTED',
          v_penalty, 0, 0, 0, v_penalty,
          _as_of, _as_of, 'DAILY_PENALTY', 'SYSTEM',
          format('Late payment charge at %s%% a year on %s for 1 day', v_rate, ROUND(v_base,2))
        );
        PERFORM public.recalc_loan_balances(v_loan.id);
        v_penalties := v_penalties + 1;

        IF v_loan.member_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.member_notifications
           WHERE member_id = v_loan.member_id AND event_type = 'PENALTY_CHARGED'
             AND created_at::date = _as_of
        ) THEN
          INSERT INTO public.member_notifications (cooperative_id, member_id, event_type, title, body)
          VALUES (v_loan.cooperative_id, v_loan.member_id, 'PENALTY_CHARGED',
                  'A late payment charge was added to your loan',
                  format('Loan %s is %s day(s) overdue and a late payment charge has been added.', v_loan.loan_number, v_dpd));
          v_notices := v_notices + 1;
        END IF;
      END IF;
    END IF;

    -- Overdue reminder, at most once every 7 days.
    IF v_dpd > 0 AND v_loan.member_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.member_notifications
       WHERE member_id = v_loan.member_id AND event_type = 'LOAN_OVERDUE'
         AND created_at > now() - interval '7 days'
    ) THEN
      INSERT INTO public.member_notifications (cooperative_id, member_id, event_type, title, body)
      VALUES (v_loan.cooperative_id, v_loan.member_id, 'LOAN_OVERDUE',
              'Your loan repayment is overdue',
              format('Loan %s is %s day(s) overdue. Please make a payment or contact the cooperative.', v_loan.loan_number, v_dpd));
      v_notices := v_notices + 1;
    END IF;
  END LOOP;

  -- Payment due today and coming up in 3 days.
  INSERT INTO public.member_notifications (cooperative_id, member_id, event_type, title, body)
  SELECT l.cooperative_id, l.member_id,
         CASE WHEN sl.due_date = _as_of THEN 'LOAN_PAYMENT_DUE' ELSE 'LOAN_PAYMENT_UPCOMING' END,
         CASE WHEN sl.due_date = _as_of THEN 'A loan repayment is due today'
              ELSE 'A loan repayment is coming up' END,
         format('Loan %s: %s due on %s.', l.loan_number,
                to_char(GREATEST(sl.total_due - sl.paid_principal - sl.paid_interest - sl.paid_fees, 0), 'FM999999990.00'),
                to_char(sl.due_date, 'DD Mon YYYY'))
  FROM public.loan_schedule_lines sl
  JOIN public.loan_schedules s ON s.id = sl.schedule_id AND s.status = 'ACTIVE'
  JOIN public.loans l ON l.id = s.loan_id AND l.status IN ('ACTIVE','RESTRUCTURED','DEFAULTED')
  WHERE sl.due_date IN (_as_of, _as_of + 3)
    AND l.member_id IS NOT NULL
    AND (sl.total_due - sl.paid_principal - sl.paid_interest - sl.paid_fees) > 0.009
    AND NOT EXISTS (
      SELECT 1 FROM public.member_notifications n
       WHERE n.member_id = l.member_id
         AND n.event_type IN ('LOAN_PAYMENT_DUE','LOAN_PAYMENT_UPCOMING')
         AND n.created_at::date = _as_of
    );
  GET DIAGNOSTICS v_dpd = ROW_COUNT;
  v_notices := v_notices + v_dpd;

  -- Reminder the day before a promised payment.
  INSERT INTO public.member_notifications (cooperative_id, member_id, event_type, title, body)
  SELECT p.cooperative_id, p.member_id, 'PROMISE_REMINDER',
         'Reminder about your payment promise',
         format('You promised to pay %s on %s.', to_char(p.amount, 'FM999999990.00'), to_char(p.promised_date, 'DD Mon YYYY'))
  FROM public.promise_to_pay p
  WHERE p.status = 'PENDING'
    AND p.promised_date = _as_of + 1
    AND p.member_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.member_notifications n
       WHERE n.member_id = p.member_id AND n.event_type = 'PROMISE_REMINDER'
         AND n.created_at::date = _as_of
    );
  GET DIAGNOSTICS v_dpd = ROW_COUNT;
  v_notices := v_notices + v_dpd;

  -- Mark promises that were not kept.
  UPDATE public.promise_to_pay
     SET status = 'BROKEN'
   WHERE status = 'PENDING'
     AND promised_date < _as_of
     AND COALESCE(fulfilled_amount, 0) < amount;

  RETURN jsonb_build_object('snapshots', v_snapshots, 'penalties', v_penalties, 'notices', v_notices, 'as_of', _as_of);
END;
$fn$;

REVOKE ALL ON FUNCTION public.run_loan_daily_maintenance(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.run_loan_daily_maintenance(date) TO authenticated, service_role;
