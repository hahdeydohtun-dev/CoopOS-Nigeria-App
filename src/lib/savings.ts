import type { Database } from "@/integrations/supabase/types";

type Enums = Database["public"]["Enums"];

export type SavingsProductType = Enums["savings_product_type"];
export type SavingsAccountStatus = Enums["savings_account_status"];
export type SavingsTransactionType = Enums["savings_transaction_type"];
export type SavingsTransactionStatus = Enums["savings_transaction_status"];
export type SavingsDirection = Enums["savings_direction"];
export type SavingsSource = Enums["savings_transaction_source"];
export type ContributionFrequency = Enums["contribution_frequency"];
export type ContributionPeriodStatus = Enums["contribution_period_status"];

export const PRODUCT_TYPES: SavingsProductType[] = ["ORDINARY", "SPECIAL", "INVESTMENT", "OTHER"];

export const ACCOUNT_STATUSES: SavingsAccountStatus[] = [
  "PENDING",
  "ACTIVE",
  "FROZEN",
  "DORMANT",
  "CLOSED",
];

export const FREQUENCIES: ContributionFrequency[] = [
  "MONTHLY",
  "WEEKLY",
  "BIWEEKLY",
  "QUARTERLY",
  "ANNUAL",
  "CUSTOM",
];

export const SOURCES: SavingsSource[] = [
  "MANUAL",
  "BANK_TRANSFER",
  "CASH",
  "CHECK_OFF",
  "IMPORT",
  "OPENING_BALANCE",
  "SYSTEM",
];

export const TRANSACTION_STATUSES: SavingsTransactionStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "CHECKED",
  "APPROVED",
  "POSTED",
  "REJECTED",
  "REVERSED",
  "CANCELLED",
];

/** Transaction types a person may record by hand, with their fixed direction. */
export const MANUAL_TRANSACTION_TYPES: {
  type: SavingsTransactionType;
  direction: SavingsDirection;
}[] = [
  { type: "CONTRIBUTION", direction: "CREDIT" },
  { type: "SPECIAL_CONTRIBUTION", direction: "CREDIT" },
  { type: "BANK_TRANSFER_CONTRIBUTION", direction: "CREDIT" },
  { type: "CASH_CONTRIBUTION", direction: "CREDIT" },
  { type: "ADJUSTMENT_CREDIT", direction: "CREDIT" },
  { type: "ADJUSTMENT_DEBIT", direction: "DEBIT" },
  { type: "OTHER_CREDIT", direction: "CREDIT" },
  { type: "OTHER_DEBIT", direction: "DEBIT" },
];

export function label(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function accountStatusTone(
  status: SavingsAccountStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "PENDING":
    case "DORMANT":
      return "secondary";
    case "FROZEN":
    case "CLOSED":
      return "destructive";
    default:
      return "outline";
  }
}

export function transactionStatusTone(
  status: SavingsTransactionStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "POSTED":
      return "default";
    case "DRAFT":
    case "SUBMITTED":
    case "CHECKED":
    case "APPROVED":
      return "secondary";
    case "REJECTED":
    case "CANCELLED":
    case "REVERSED":
      return "destructive";
    default:
      return "outline";
  }
}

/** The next statuses a transaction may legally move to. */
export function nextStatuses(
  current: SavingsTransactionStatus,
): SavingsTransactionStatus[] {
  switch (current) {
    case "DRAFT":
      return ["SUBMITTED", "CANCELLED"];
    case "SUBMITTED":
      return ["CHECKED", "REJECTED"];
    case "CHECKED":
      return ["APPROVED", "REJECTED"];
    case "APPROVED":
      return ["POSTED", "REJECTED"];
    case "POSTED":
      return ["REVERSED"];
    default:
      return [];
  }
}

export function signedAmount(direction: SavingsDirection, amount: number): number {
  return direction === "CREDIT" ? amount : -amount;
}

/** Month key such as "September 2026" for a given date. */
export function periodNameFor(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric" }).format(date);
}

export function friendlySavingsError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/posted savings transaction cannot be changed/i.test(message))
    return "This entry has already been posted. Record a reversal instead of changing it.";
  if (/cannot be deleted/i.test(message))
    return "Savings entries are permanent. Record a reversal instead of deleting.";
  if (/reason is required/i.test(message)) return "Please give a reason for this reversal.";
  if (/duplicate key/i.test(message) && /account_number/i.test(message))
    return "That savings account number is already in use in this cooperative.";
  if (/duplicate key/i.test(message) && /product_code/i.test(message))
    return "That product code is already in use in this cooperative.";
  if (/duplicate key/i.test(message))
    return "A record with those details already exists.";
  if (/row-level security|permission/i.test(message))
    return "You do not have permission to make this change.";
  return message || "Something went wrong. Please try again.";
}
