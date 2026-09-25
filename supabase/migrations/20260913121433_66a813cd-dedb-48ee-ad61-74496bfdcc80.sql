
CREATE OR REPLACE FUNCTION public.savings_balance_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.recalc_savings_account_balance(NEW.savings_account_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.savings_balance_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.savings_balance_sync() TO service_role;
REVOKE ALL ON FUNCTION public.enforce_savings_transaction_immutability() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_savings_transaction_immutability() TO service_role;
REVOKE ALL ON FUNCTION public.set_savings_eligible_from() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_savings_eligible_from() TO service_role;
REVOKE ALL ON FUNCTION public.savings_locked_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.savings_locked_sync() TO service_role;
