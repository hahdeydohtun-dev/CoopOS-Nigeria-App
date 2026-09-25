# CoopOS Project Handoff

Current handoff: Phase 8 Accounting + General Ledger.

## Existing accounting routes

- `/admin/accounting`
- `/admin/accounting/accounts`
- `/admin/accounting/journals`
- `/admin/accounting/mappings`
- `/admin/accounting/trial-balance`
- `/admin/accounting/general-ledger`

## Accounting architecture

The existing Supabase accounting engine is the source of accounting truth. The UI must consume the existing RPCs/services and must not create a second ledger or independently mutate accounting balances.

Key existing accounting capabilities include journal posting, account ledger retrieval, trial balance, subledger reconciliation, posting mappings, journal reversal, and accounting exceptions.

## Next Phase 8 work

Continue with:

1. Financial Statements
2. Accounting Reconciliations
3. Accounting Issues / Exceptions
4. Suspense Register
5. Accrual Register
6. Prepayment Register
7. Fixed Asset Register
8. Accounting Periods
9. Period Close / Year-End Close
10. Accounting Reports

Then proceed to Phase 9 Banking/Reconciliation.
