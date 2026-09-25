import { supabase } from "@/integrations/supabase/client";

export type JournalStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "CHECKED"
  | "APPROVED"
  | "POSTED"
  | "REJECTED"
  | "REVERSED"
  | "CANCELLED";

export const JOURNAL_STATUSES: JournalStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "CHECKED",
  "APPROVED",
  "POSTED",
  "REJECTED",
  "REVERSED",
  "CANCELLED",
];

export const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Events the posting engine understands. Mappings are configured per cooperative. */
export const ACCOUNTING_EVENTS = [
  "SAVINGS_CONTRIBUTION_POSTED",
  "SAVINGS_OPENING_BALANCE",
  "SAVINGS_WITHDRAWAL_POSTED",
  "SAVINGS_REVERSAL_POSTED",
  "SAVINGS_INTEREST_CREDITED",
  "SAVINGS_BONUS_CREDITED",
  "CHECKOFF_RECEIVED",
  "CHECKOFF_SETTLEMENT_RECEIVED",
  "WITHDRAWAL_FEE_CHARGED",
  "LOAN_DISBURSED",
  "LOAN_INTEREST_ACCRUED",
  "LOAN_FEE_CHARGED",
  "LOAN_PENALTY_CHARGED",
  "LOAN_PRINCIPAL_REPAID",
  "LOAN_INTEREST_REPAID",
  "LOAN_FEE_REPAID",
  "LOAN_PENALTY_REPAID",
  "LOAN_WRITTEN_OFF",
  "MEMBERSHIP_FEE_RECEIVED",
  "SHARE_CAPITAL_RECEIVED",
  "INVESTMENT_INCOME_RECEIVED",
  "BANK_CHARGE_POSTED",
] as const;

export function label(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function journalStatusTone(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "POSTED") return "default";
  if (status === "REJECTED" || status === "CANCELLED" || status === "REVERSED") return "destructive";
  if (status === "DRAFT") return "outline";
  return "secondary";
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function friendlyAccountingError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/unbalanced/i.test(message)) return "The journal does not balance: debits must equal credits.";
  if (/CLOSED accounting period|period is closed|closed\./i.test(message))
    return "That accounting period is closed, so nothing can be posted into it.";
  if (/immutable|cannot be changed|never be deleted/i.test(message))
    return "A posted journal can never be changed or deleted. Post a reversal instead.";
  if (/inactive account/i.test(message))
    return "One of the accounts is switched off and cannot take new entries.";
  if (/permission/i.test(message)) return "You do not have permission to do that.";
  if (/cannot also approve/i.test(message))
    return "The person who raised a journal cannot also approve it.";
  if (/duplicate key|uq_je_source/i.test(message))
    return "This entry has already been recorded in the ledger.";
  return message || "Something went wrong.";
}

export type TrialBalanceRow = {
  account_id: string;
  code: string;
  name: string;
  account_type: AccountType;
  account_subtype: string | null;
  normal_balance: "DEBIT" | "CREDIT";
  opening: number;
  debit: number;
  credit: number;
  net: number;
};

export async function loadTrialBalance(
  coopId: string,
  from: string,
  to: string,
): Promise<TrialBalanceRow[]> {
  const { data, error } = await supabase.rpc("trial_balance", {
    _cooperative_id: coopId,
    _from: from,
    _to: to,
  });
  if (error) throw error;
  return (data ?? []) as unknown as TrialBalanceRow[];
}

/** Balance in the account's own natural direction (assets/expenses debit-positive). */
export function naturalBalance(row: TrialBalanceRow): number {
  return row.normal_balance === "DEBIT" ? Number(row.net) : -Number(row.net);
}

export function sumByType(rows: TrialBalanceRow[], type: AccountType): number {
  return rows.filter((r) => r.account_type === type).reduce((s, r) => s + naturalBalance(r), 0);
}

export function sumBySubtype(rows: TrialBalanceRow[], subtype: string): number {
  return rows
    .filter((r) => (r.account_subtype ?? "") === subtype)
    .reduce((s, r) => s + naturalBalance(r), 0);
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
