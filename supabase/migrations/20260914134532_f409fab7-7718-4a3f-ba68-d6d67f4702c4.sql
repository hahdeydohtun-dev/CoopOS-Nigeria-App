REVOKE ALL ON FUNCTION public.run_loan_daily_maintenance(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_loan_daily_maintenance(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.run_loan_daily_maintenance(date) TO authenticated, service_role;