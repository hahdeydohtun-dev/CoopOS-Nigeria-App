/**
 * Accounting reconciliation helpers.
 *
 * The authoritative maths lives in the database: `subledger_reconciliation()` returns, per
 * subledger, the operational balance, the General Ledger balance and their difference. Nothing
 * here recomputes a balance or a difference. This module only
 *   - describes each reconciliation type (so new types can be added without touching the screen),
 *   - classifies an RPC row into a display status,
 *   - aggregates rows for the summary cards.
 *
 * No imports on purpose: the module is plain TypeScript so it can be exercised without the app.
 */

export type ReconciliationStatus = "RECONCILED" | "OUT_OF_BALANCE" | "NO_DATA" | "ERROR";

/** One row exactly as returned by `subledger_reconciliation()`. */
export type SubledgerRow = {
  subledger: string;
  subledger_balance: number | string;
  gl_balance: number | string;
  difference: number | string;
};

/** Existing routes an accountant can be sent to while investigating. */
export type InvestigationTarget =
  | "/admin/accounting/general-ledger"
  | "/admin/accounting/journals"
  | "/admin/accounting/trial-balance"
  | "/admin/accounting/exceptions"
  | "/admin/savings/transactions"
  | "/admin/loans/book";

export type ReconciliationType = {
  key: string;
  /** Exact value of the `subledger` column returned by `subledger_reconciliation()`. */
  rpcLabel: string;
  title: string;
  /** Plain-language description of the GL side, mirroring the RPC's definition. */
  glBasis: string;
  /** `accounting_exceptions.source_type` values whose open exceptions can affect this subledger. */
  exceptionSourceTypes: string[];
  investigate: { label: string; to: InvestigationTarget }[];
};

/**
 * Add a new reconciliation type by adding one entry here (and the matching branch in the RPC).
 * A subledger returned by the RPC that has no entry is still shown, using `genericType()`.
 */
export const RECONCILIATION_TYPES: ReconciliationType[] = [
  {
    key: "SAVINGS",
    rpcLabel: "Member savings",
    title: "Member savings → GL",
    glBasis: "GL accounts with subtype SAVINGS (net credit balance)",
    exceptionSourceTypes: ["SAVINGS_TRANSACTION"],
    investigate: [
      { label: "Savings transactions", to: "/admin/savings/transactions" },
      { label: "Journal entries", to: "/admin/accounting/journals" },
      { label: "General ledger", to: "/admin/accounting/general-ledger" },
      { label: "Accounting exceptions", to: "/admin/accounting/exceptions" },
    ],
  },
  {
    key: "LOANS",
    rpcLabel: "Loans receivable",
    title: "Loan receivables → GL",
    glBasis: "GL accounts with subtype LOANS (net debit balance)",
    exceptionSourceTypes: ["LOAN_TRANSACTION"],
    investigate: [
      { label: "Loan book", to: "/admin/loans/book" },
      { label: "Journal entries", to: "/admin/accounting/journals" },
      { label: "General ledger", to: "/admin/accounting/general-ledger" },
      { label: "Accounting exceptions", to: "/admin/accounting/exceptions" },
    ],
  },
];

export function genericType(rpcLabel: string): ReconciliationType {
  return {
    key: rpcLabel,
    rpcLabel,
    title: rpcLabel,
    glBasis: "As defined by subledger_reconciliation()",
    exceptionSourceTypes: [],
    investigate: [
      { label: "Journal entries", to: "/admin/accounting/journals" },
      { label: "General ledger", to: "/admin/accounting/general-ledger" },
      { label: "Trial balance", to: "/admin/accounting/trial-balance" },
      { label: "Accounting exceptions", to: "/admin/accounting/exceptions" },
    ],
  };
}

export function resolveType(rpcLabel: string): ReconciliationType {
  return RECONCILIATION_TYPES.find((t) => t.rpcLabel === rpcLabel) ?? genericType(rpcLabel);
}

/** Half a kobo: amounts are numeric(_, 2) so anything smaller is rounding, not a difference. */
export const RECONCILIATION_TOLERANCE = 0.005;

export function classifyRow(row: SubledgerRow): ReconciliationStatus {
  const sub = Number(row.subledger_balance);
  const gl = Number(row.gl_balance);
  const diff = Number(row.difference);
  if (!Number.isFinite(sub) || !Number.isFinite(gl) || !Number.isFinite(diff)) return "ERROR";
  if (Math.abs(sub) < RECONCILIATION_TOLERANCE && Math.abs(gl) < RECONCILIATION_TOLERANCE) {
    return "NO_DATA";
  }
  return Math.abs(diff) < RECONCILIATION_TOLERANCE ? "RECONCILED" : "OUT_OF_BALANCE";
}

export type ReconciliationSummary = {
  glTotal: number;
  subledgerTotal: number;
  /** Sum of |difference| as reported by the RPC, so opposite differences can never cancel out. */
  absoluteDifference: number;
  status: ReconciliationStatus;
};

/** Worst status wins: ERROR > OUT_OF_BALANCE > RECONCILED > NO_DATA. */
export function summarise(rows: SubledgerRow[]): ReconciliationSummary {
  let glTotal = 0;
  let subledgerTotal = 0;
  let absoluteDifference = 0;
  const statuses = rows.map(classifyRow);
  for (const row of rows) {
    const sub = Number(row.subledger_balance);
    const gl = Number(row.gl_balance);
    const diff = Number(row.difference);
    if (Number.isFinite(sub)) subledgerTotal += sub;
    if (Number.isFinite(gl)) glTotal += gl;
    if (Number.isFinite(diff)) absoluteDifference += Math.abs(diff);
  }
  let status: ReconciliationStatus = "NO_DATA";
  if (statuses.includes("ERROR")) status = "ERROR";
  else if (statuses.includes("OUT_OF_BALANCE")) status = "OUT_OF_BALANCE";
  else if (statuses.includes("RECONCILED")) status = "RECONCILED";
  return { glTotal, subledgerTotal, absoluteDifference, status };
}

export const STATUS_LABELS: Record<ReconciliationStatus, string> = {
  RECONCILED: "Reconciled",
  OUT_OF_BALANCE: "Out of balance",
  NO_DATA: "No data",
  ERROR: "Error",
};

export function reconciliationCsvRows(
  rows: SubledgerRow[],
  meta: { cooperative: string; asOf: string },
): Record<string, unknown>[] {
  return rows.map((row) => {
    const type = resolveType(row.subledger);
    return {
      cooperative: meta.cooperative,
      as_of: meta.asOf,
      reconciliation: type.title,
      gl_basis: type.glBasis,
      subledger_balance: row.subledger_balance,
      gl_balance: row.gl_balance,
      difference: row.difference,
      status: STATUS_LABELS[classifyRow(row)],
    };
  });
}
