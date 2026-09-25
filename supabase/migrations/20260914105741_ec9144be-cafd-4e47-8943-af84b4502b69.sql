REVOKE EXECUTE ON FUNCTION public.loan_balance_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_loan_transaction_immutability() FROM PUBLIC, anon, authenticated;