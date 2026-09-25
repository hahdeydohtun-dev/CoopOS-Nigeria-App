import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { nextTransactionNumber } from "@/lib/savings-accounts";
import { notifyMembers, notifyStaff } from "@/lib/notify";

type Enums = Database["public"]["Enums"];
export type WithdrawalStatus = Enums["withdrawal_status"];
export type WithdrawalEligibilityStatus = Enums["withdrawal_eligibility_status"];
export type WithdrawalHoldStatus = Enums["withdrawal_hold_status"];
export type WithdrawalPayoutStatus = Enums["withdrawal_payout_status"];
export type ExitSettlementStatus = Enums["exit_settlement_status"];
export type WithdrawalType = Database["public"]["Tables"]["withdrawal_types"]["Row"];

export const LIVE_LOAN_STATUSES = ["ACTIVE", "RESTRUCTURED", "DEFAULTED"] as const;

export const WITHDRAWAL_STATUSES: WithdrawalStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "ELIGIBILITY_CHECK",
  "UNDER_REVIEW",
  "CHECKED",
  "APPROVED",
  "PAYMENT_PENDING",
  "PROCESSING",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "FAILED",
  "REVERSED",
  "EXPIRED",
];

export function label(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function statusTone(
  status: WithdrawalStatus | WithdrawalPayoutStatus | ExitSettlementStatus | string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "COMPLETED":
    case "SUCCESSFUL":
    case "SETTLED":
    case "APPROVED":
      return "default";
    case "REJECTED":
    case "FAILED":
    case "REVERSED":
    case "CANCELLED":
    case "EXPIRED":
      return "destructive";
    case "DRAFT":
      return "outline";
    default:
      return "secondary";
  }
}

/** Statuses a request may legally move to. Segregation of duties is enforced by callers. */
export function nextStatuses(status: WithdrawalStatus): WithdrawalStatus[] {
  switch (status) {
    case "DRAFT":
      return ["SUBMITTED", "CANCELLED"];
    case "SUBMITTED":
      return ["UNDER_REVIEW", "CHECKED", "REJECTED", "CANCELLED"];
    case "ELIGIBILITY_CHECK":
    case "UNDER_REVIEW":
      return ["CHECKED", "REJECTED", "CANCELLED"];
    case "CHECKED":
      return ["APPROVED", "REJECTED", "CANCELLED"];
    case "APPROVED":
      return ["PAYMENT_PENDING", "PROCESSING", "CANCELLED"];
    case "PAYMENT_PENDING":
      return ["PROCESSING", "CANCELLED"];
    case "PROCESSING":
      return ["COMPLETED", "FAILED"];
    case "FAILED":
      return ["PROCESSING", "CANCELLED"];
    case "COMPLETED":
      return ["REVERSED"];
    default:
      return [];
  }
}

export function friendlyWithdrawalError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("row-level security")) {
    return "You do not have permission to do this.";
  }
  if (message.includes("completed withdrawal")) {
    return "A completed withdrawal cannot be edited. Reverse it instead.";
  }
  return message || "Something went wrong.";
}

export async function assertPeriodOpen(coopId: string, date: string) {
  const { data } = await supabase
    .from("accounting_periods")
    .select("name, status")
    .eq("cooperative_id", coopId)
    .lte("start_date", date)
    .gte("end_date", date)
    .maybeSingle();
  if (data && data.status === "CLOSED") {
    throw new Error(`The accounting period ${data.name} is closed, so nothing can be posted into it.`);
  }
}

function monthsBetween(from: string | null | undefined, to = new Date()): number {
  if (!from) return 0;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(
    0,
    (to.getFullYear() - start.getFullYear()) * 12 +
      (to.getMonth() - start.getMonth()) -
      (to.getDate() < start.getDate() ? 1 : 0),
  );
}

function periodStart(type: WithdrawalType, today = new Date()): string | null {
  const d = new Date(today);
  switch (type.frequency_period) {
    case "CALENDAR_YEAR":
      return `${d.getFullYear()}-01-01`;
    case "ROLLING_YEAR": {
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString().slice(0, 10);
    }
    case "CALENDAR_MONTH":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    case "QUARTER": {
      const q = Math.floor(d.getMonth() / 3) * 3;
      return `${d.getFullYear()}-${String(q + 1).padStart(2, "0")}-01`;
    }
    case "ROLLING_DAYS": {
      const days = type.frequency_rolling_days ?? 0;
      if (!days) return null;
      d.setDate(d.getDate() - days);
      return d.toISOString().slice(0, 10);
    }
    default:
      return null;
  }
}

export type SavingsPosition = {
  accountId: string;
  accountNumber: string;
  productId: string;
  productName: string;
  productType: string;
  status: string;
  currentBalance: number;
  lockedBalance: number;
  availableBalance: number;
  openedDate: string | null;
};

export type MemberPosition = {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    membershipNumber: string;
    joinDate: string;
    lifecycleStatus: string;
  };
  accounts: SavingsPosition[];
  eligibleAccounts: SavingsPosition[];
  savingsBalance: number;
  lockedBalance: number;
  activeHolds: number;
  availableBalance: number;
  outstandingLoanBalance: number;
  overdueAmount: number;
  membershipTenureMonths: number;
  savingsTenureMonths: number;
  lastWithdrawalDate: string | null;
  withdrawalsInPeriod: number;
};

/** Live balances, loans, tenure and prior withdrawals — always read from the authoritative tables. */
export async function loadMemberPosition(
  coopId: string,
  memberId: string,
  type: WithdrawalType | null,
): Promise<MemberPosition> {
  const [{ data: member, error: memberErr }, { data: accountRows }, { data: loanRows }, { data: holdRows }] =
    await Promise.all([
      supabase
        .from("members")
        .select("id, first_name, last_name, membership_number, join_date, lifecycle_status")
        .eq("id", memberId)
        .single(),
      supabase
        .from("member_savings_accounts")
        .select(
          "id, account_number, savings_product_id, status, current_balance, locked_balance, available_balance, opened_date, savings_products(product_name, product_type, withdrawal_allowed)",
        )
        .eq("cooperative_id", coopId)
        .eq("member_id", memberId),
      supabase
        .from("loans")
        .select("id, status, total_outstanding")
        .eq("cooperative_id", coopId)
        .eq("member_id", memberId)
        .in("status", [...LIVE_LOAN_STATUSES]),
      supabase
        .from("withdrawal_holds")
        .select("amount")
        .eq("cooperative_id", coopId)
        .eq("member_id", memberId)
        .eq("status", "ACTIVE"),
    ]);
  if (memberErr) throw memberErr;

  const accounts: SavingsPosition[] = (accountRows ?? []).map((row) => {
    const product = (row as { savings_products: { product_name: string; product_type: string } | null })
      .savings_products;
    return {
      accountId: row.id,
      accountNumber: row.account_number,
      productId: row.savings_product_id,
      productName: product?.product_name ?? "Savings",
      productType: product?.product_type ?? "OTHER",
      status: String(row.status),
      currentBalance: Number(row.current_balance ?? 0),
      lockedBalance: Number(row.locked_balance ?? 0),
      availableBalance: Number(row.available_balance ?? 0),
      openedDate: row.opened_date,
    };
  });

  const eligibleAccounts = accounts.filter((a) => {
    if (a.status !== "ACTIVE") return false;
    if (!type) return true;
    const byId = (type.eligible_savings_products ?? []) as string[];
    const byType = (type.eligible_product_types ?? []) as string[];
    if (byId.length > 0) return byId.includes(a.productId);
    if (byType.length > 0) return byType.includes(a.productType);
    return true;
  });

  const loanIds = (loanRows ?? []).map((l) => l.id);
  let overdueAmount = 0;
  if (loanIds.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: schedules } = await supabase
      .from("loan_schedules")
      .select("id")
      .in("loan_id", loanIds)
      .eq("status", "ACTIVE");
    const scheduleIds = (schedules ?? []).map((s) => s.id);
    if (scheduleIds.length > 0) {
      const { data: lines } = await supabase
        .from("loan_schedule_lines")
        .select("total_due, paid_principal, paid_interest, paid_fees, due_date")
        .in("schedule_id", scheduleIds)
        .lt("due_date", today);
      overdueAmount = (lines ?? []).reduce((sum, l) => {
        const paid =
          Number(l.paid_principal ?? 0) + Number(l.paid_interest ?? 0) + Number(l.paid_fees ?? 0);
        return sum + Math.max(0, Number(l.total_due ?? 0) - paid);
      }, 0);
    }
  }


  const activeHolds = (holdRows ?? []).reduce((s, h) => s + Number(h.amount ?? 0), 0);
  const savingsBalance = eligibleAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const lockedBalance = eligibleAccounts.reduce((s, a) => s + a.lockedBalance, 0);

  // Earliest contribution tells us how long the member has actually been saving.
  const { data: firstTx } = await supabase
    .from("savings_transactions")
    .select("transaction_date")
    .eq("cooperative_id", coopId)
    .eq("member_id", memberId)
    .eq("status", "POSTED")
    .eq("direction", "CREDIT")
    .order("transaction_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: priorRequests } = await supabase
    .from("withdrawal_requests")
    .select("request_date, status, withdrawal_type_id")
    .eq("cooperative_id", coopId)
    .eq("member_id", memberId)
    .in("status", ["SUBMITTED", "UNDER_REVIEW", "CHECKED", "APPROVED", "PROCESSING", "COMPLETED"])
    .order("request_date", { ascending: false });

  const relevant = (priorRequests ?? []).filter((r) => !type || r.withdrawal_type_id === type.id);
  const from = type ? periodStart(type) : null;
  const withdrawalsInPeriod = from ? relevant.filter((r) => r.request_date >= from).length : relevant.length;

  return {
    member: {
      id: member.id,
      firstName: member.first_name,
      lastName: member.last_name,
      membershipNumber: member.membership_number,
      joinDate: member.join_date,
      lifecycleStatus: String(member.lifecycle_status),
    },
    accounts,
    eligibleAccounts,
    savingsBalance,
    lockedBalance,
    activeHolds,
    availableBalance: Math.max(0, savingsBalance - lockedBalance - activeHolds),
    outstandingLoanBalance: (loanRows ?? []).reduce((s, l) => s + Number(l.total_outstanding ?? 0), 0),
    overdueAmount,
    membershipTenureMonths: monthsBetween(member.join_date),
    savingsTenureMonths: monthsBetween(firstTx?.transaction_date ?? null),
    lastWithdrawalDate: relevant[0]?.request_date ?? null,
    withdrawalsInPeriod,
  };
}

export type EligibilityResult = {
  status: WithdrawalEligibilityStatus;
  maximumAllowed: number;
  eligibleAmount: number;
  failureReasons: string[];
  fee: number;
  netPayout: number;
  position: MemberPosition;
  ruleSnapshot: Record<string, unknown>;
};

export function calculateFee(type: WithdrawalType, amount: number): number {
  if (type.fee_type === "FLAT") return Number(type.fee_value ?? 0);
  if (type.fee_type === "PERCENTAGE") return (amount * Number(type.fee_value ?? 0)) / 100;
  return 0;
}

/** Applies the cooperative's configured rules — nothing here is hard-coded policy. */
export function evaluateEligibility(
  type: WithdrawalType,
  position: MemberPosition,
  requestedAmount: number,
): EligibilityResult {
  const reasons: string[] = [];

  if (!type.active) reasons.push("This withdrawal type is not currently available.");

  const statuses = (type.allowed_member_statuses ?? []) as string[];
  if (statuses.length > 0 && !statuses.includes(position.member.lifecycleStatus)) {
    reasons.push(`Members with the status ${label(position.member.lifecycleStatus)} cannot use this withdrawal type.`);
  }
  if (position.membershipTenureMonths < (type.minimum_membership_months ?? 0)) {
    reasons.push(`Membership of at least ${type.minimum_membership_months} months is required.`);
  }
  if (position.savingsTenureMonths < (type.minimum_savings_months ?? 0)) {
    reasons.push(`At least ${type.minimum_savings_months} months of continuous savings is required.`);
  }
  if (type.requires_no_active_loan && position.outstandingLoanBalance > 0) {
    reasons.push("This withdrawal type is not available while a loan is still running.");
  }
  if (type.requires_no_delinquency && position.overdueAmount > 0) {
    reasons.push("There is an overdue loan amount that must be cleared first.");
  }
  if (type.frequency_limit != null && position.withdrawalsInPeriod >= type.frequency_limit) {
    reasons.push(`Only ${type.frequency_limit} withdrawal(s) of this kind are allowed in the set period.`);
  }
  if ((type.cooling_period_days ?? 0) > 0 && position.lastWithdrawalDate) {
    const days = Math.floor(
      (Date.now() - new Date(position.lastWithdrawalDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days < (type.cooling_period_days ?? 0)) {
      reasons.push(`A waiting period of ${type.cooling_period_days} days applies between withdrawals.`);
    }
  }
  if (position.eligibleAccounts.length === 0) {
    reasons.push("The member has no active savings account of the kind this withdrawal type covers.");
  }

  const byPercentage =
    type.maximum_percentage != null
      ? position.savingsBalance * Number(type.maximum_percentage)
      : Number.POSITIVE_INFINITY;
  const byAmount = type.maximum_amount != null ? Number(type.maximum_amount) : Number.POSITIVE_INFINITY;
  const byBalanceFloor = Math.max(0, position.availableBalance - Number(type.minimum_balance_after ?? 0));

  const maximumAllowed = Math.max(0, Math.min(byPercentage, byAmount, byBalanceFloor));

  if (requestedAmount > 0 && requestedAmount < Number(type.minimum_amount ?? 0)) {
    reasons.push(`The smallest amount allowed is ${type.minimum_amount}.`);
  }

  const eligibleAmount = Math.min(requestedAmount > 0 ? requestedAmount : maximumAllowed, maximumAllowed);
  const fee = calculateFee(type, eligibleAmount);

  let status: WithdrawalEligibilityStatus = "ELIGIBLE";
  if (reasons.length > 0 || maximumAllowed <= 0) status = "NOT_ELIGIBLE";
  else if (requestedAmount > 0 && eligibleAmount + 0.005 < requestedAmount) status = "PARTIALLY_ELIGIBLE";

  return {
    status,
    maximumAllowed,
    eligibleAmount,
    failureReasons: reasons,
    fee,
    netPayout: Math.max(0, eligibleAmount - fee),
    position,
    ruleSnapshot: {
      code: type.code,
      name: type.name,
      maximum_percentage: type.maximum_percentage,
      maximum_amount: type.maximum_amount,
      minimum_amount: type.minimum_amount,
      minimum_balance_after: type.minimum_balance_after,
      minimum_membership_months: type.minimum_membership_months,
      minimum_savings_months: type.minimum_savings_months,
      frequency_limit: type.frequency_limit,
      frequency_period: type.frequency_period,
      frequency_rolling_days: type.frequency_rolling_days,
      cooling_period_days: type.cooling_period_days,
      requires_no_active_loan: type.requires_no_active_loan,
      requires_no_delinquency: type.requires_no_delinquency,
      fee_type: type.fee_type,
      fee_value: type.fee_value,
      rules_configuration: type.rules_configuration,
      evaluated_at: new Date().toISOString(),
    },
  };
}

export async function nextWithdrawalNumber(coopId: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_withdrawal_number", { _cooperative_id: coopId });
  if (error) throw error;
  return data as string;
}

export async function nextExitSettlementNumber(coopId: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_exit_settlement_number", { _cooperative_id: coopId });
  if (error) throw error;
  return data as string;
}

export type CreateRequestInput = {
  coopId: string;
  memberId: string;
  type: WithdrawalType;
  savingsAccountId: string | null;
  requestedAmount: number;
  purpose: string | null;
  bankAccountId: string | null;
  requestedPaymentDate: string | null;
  documentId?: string | null;
  userId: string | null;
  submit: boolean;
};

/** Creates the request, stores the eligibility snapshot and holds the money while it is pending. */
export async function createWithdrawalRequest(input: CreateRequestInput) {
  const position = await loadMemberPosition(input.coopId, input.memberId, input.type);
  const evaluation = evaluateEligibility(input.type, position, input.requestedAmount);

  if (input.type.requires_purpose && !input.purpose?.trim()) {
    throw new Error("A reason for this withdrawal is required.");
  }
  if (input.type.requires_document && !input.documentId) {
    throw new Error("A supporting document is required for this withdrawal.");
  }
  if (evaluation.status === "NOT_ELIGIBLE") {
    throw new Error(evaluation.failureReasons[0] ?? "This withdrawal is not allowed under the current rules.");
  }
  if (input.bankAccountId) {
    const { data: bank } = await supabase
      .from("member_bank_accounts")
      .select("id, active, is_verified, change_status")
      .eq("id", input.bankAccountId)
      .maybeSingle();
    if (!bank || !bank.active || !bank.is_verified || bank.change_status === "PENDING") {
      throw new Error("The payout account must be a verified, approved and active bank account.");
    }
  }

  const account =
    input.savingsAccountId ??
    position.eligibleAccounts.slice().sort((a, b) => b.availableBalance - a.availableBalance)[0]?.accountId ??
    null;
  const productId = position.eligibleAccounts.find((a) => a.accountId === account)?.productId ?? null;

  const number = await nextWithdrawalNumber(input.coopId);
  const { data: request, error } = await supabase
    .from("withdrawal_requests")
    .insert({
      cooperative_id: input.coopId,
      withdrawal_number: number,
      member_id: input.memberId,
      withdrawal_type_id: input.type.id,
      savings_account_id: account,
      savings_product_id: productId,
      requested_amount: input.requestedAmount,
      eligible_amount: evaluation.eligibleAmount,
      fee_amount: evaluation.fee,
      net_payout_amount: evaluation.netPayout,
      purpose: input.purpose?.trim() || null,
      destination_bank_account_id: input.bankAccountId,
      requested_payment_date: input.requestedPaymentDate,
      document_id: input.documentId ?? null,
      status: input.submit ? "SUBMITTED" : "DRAFT",
      eligibility_status: evaluation.status,
      eligibility_snapshot: evaluation.ruleSnapshot as never,
      submitted_at: input.submit ? new Date().toISOString() : null,
      created_by: input.userId,
    })
    .select("id, withdrawal_number")
    .single();
  if (error) throw error;

  await supabase.from("withdrawal_eligibility_checks").insert({
    cooperative_id: input.coopId,
    withdrawal_request_id: request.id,
    member_id: input.memberId,
    withdrawal_type_id: input.type.id,
    savings_balance: position.savingsBalance,
    restricted_balance: position.lockedBalance,
    pledged_balance: position.lockedBalance,
    reserved_balance: position.activeHolds,
    available_balance: position.availableBalance,
    outstanding_loan_balance: position.outstandingLoanBalance,
    overdue_amount: position.overdueAmount,
    membership_tenure_months: position.membershipTenureMonths,
    savings_tenure_months: position.savingsTenureMonths,
    last_withdrawal_date: position.lastWithdrawalDate,
    withdrawals_in_period: position.withdrawalsInPeriod,
    maximum_allowed: evaluation.maximumAllowed,
    calculated_eligible_amount: evaluation.eligibleAmount,
    eligibility_status: evaluation.status,
    failure_reasons: evaluation.failureReasons,
    rule_snapshot: evaluation.ruleSnapshot as never,
    calculated_by: input.userId,
  });

  if (input.submit) {
    await supabase.from("withdrawal_holds").insert({
      cooperative_id: input.coopId,
      member_id: input.memberId,
      withdrawal_request_id: request.id,
      savings_account_id: account,
      amount: evaluation.eligibleAmount,
      reason: `Pending withdrawal ${request.withdrawal_number}`,
      created_by: input.userId,
    });
    await notifyStaff({
      cooperativeId: input.coopId,
      eventType: "WITHDRAWAL_SUBMITTED",
      title: `Withdrawal ${request.withdrawal_number} submitted`,
      body: `${position.member.firstName} ${position.member.lastName} requested a withdrawal.`,
      link: "/admin/withdrawals/pending",
      severity: "ACTION",
    });
    await notifyMembers(input.coopId, [input.memberId], {
      eventType: "WITHDRAWAL_SUBMITTED",
      title: "Withdrawal request received",
      body: `Your request ${request.withdrawal_number} is being reviewed.`,
    });
  }

  return request;
}

async function releaseHolds(requestId: string, status: WithdrawalHoldStatus, userId: string | null) {
  await supabase
    .from("withdrawal_holds")
    .update({ status, released_at: new Date().toISOString(), released_by: userId })
    .eq("withdrawal_request_id", requestId)
    .eq("status", "ACTIVE");
}

export type MoveInput = {
  coopId: string;
  requestId: string;
  to: WithdrawalStatus;
  userId: string | null;
  reason?: string | null;
  approvedAmount?: number | null;
};

/** Maker–checker–approver movement. The same person may not check and approve. */
export async function moveWithdrawal(input: MoveInput) {
  const { data: request, error } = await supabase
    .from("withdrawal_requests")
    .select(
      "id, withdrawal_number, member_id, status, created_by, checked_by, eligible_amount, fee_amount, approved_amount",
    )
    .eq("id", input.requestId)
    .single();
  if (error) throw error;

  const current = request.status as WithdrawalStatus;
  if (!nextStatuses(current).includes(input.to)) {
    throw new Error(`A ${label(current)} request cannot move to ${label(input.to)}.`);
  }
  if (input.to === "CHECKED" && request.created_by && request.created_by === input.userId) {
    throw new Error("The person who raised a request cannot also check it.");
  }
  if (input.to === "APPROVED" && request.checked_by && request.checked_by === input.userId) {
    throw new Error("The person who checked a request cannot also approve it.");
  }

  const now = new Date().toISOString();
  const patch: Database["public"]["Tables"]["withdrawal_requests"]["Update"] = { status: input.to };

  if (input.to === "SUBMITTED") patch.submitted_at = now;
  if (input.to === "CHECKED") {
    patch.checked_at = now;
    patch.checked_by = input.userId;
  }
  if (input.to === "APPROVED") {
    const amount = input.approvedAmount ?? Number(request.eligible_amount ?? 0);
    patch.approved_at = now;
    patch.approved_by = input.userId;
    patch.approved_amount = amount;
    patch.net_payout_amount = Math.max(0, amount - Number(request.fee_amount ?? 0));
  }
  if (input.to === "REJECTED") {
    patch.rejected_at = now;
    patch.rejection_reason = input.reason ?? null;
  }
  if (input.to === "CANCELLED") {
    patch.cancelled_at = now;
    patch.cancellation_reason = input.reason ?? null;
  }
  if (input.reason && input.to !== "REJECTED" && input.to !== "CANCELLED") patch.notes = input.reason;

  const { error: updateErr } = await supabase
    .from("withdrawal_requests")
    .update(patch)
    .eq("id", input.requestId);
  if (updateErr) throw updateErr;

  if (input.to === "REJECTED" || input.to === "CANCELLED") {
    await releaseHolds(input.requestId, input.to === "REJECTED" ? "RELEASED" : "CANCELLED", input.userId);
    await notifyMembers(input.coopId, [request.member_id], {
      eventType: `WITHDRAWAL_${input.to}`,
      title: `Withdrawal ${request.withdrawal_number} ${input.to === "REJECTED" ? "declined" : "cancelled"}`,
      ...(input.reason ? { body: input.reason } : {}),
    });
  }
  if (input.to === "APPROVED") {
    await notifyMembers(input.coopId, [request.member_id], {
      eventType: "WITHDRAWAL_APPROVED",
      title: `Withdrawal ${request.withdrawal_number} approved`,
      body: "Payment will follow shortly.",
    });
  }
  return request;
}

/** Posts the savings debit, records the payout and completes the withdrawal. */
export async function processWithdrawalPayout(input: {
  coopId: string;
  requestId: string;
  paymentReference: string | null;
  paymentProvider: string | null;
  bankReference: string | null;
  paymentDate: string;
  userId: string | null;
}) {
  const { data: request, error } = await supabase
    .from("withdrawal_requests")
    .select(
      "id, withdrawal_number, member_id, status, savings_account_id, savings_product_id, approved_amount, eligible_amount, fee_amount, net_payout_amount, destination_bank_account_id, savings_transaction_id",
    )
    .eq("id", input.requestId)
    .single();
  if (error) throw error;
  if (!["APPROVED", "PAYMENT_PENDING", "PROCESSING", "FAILED"].includes(String(request.status))) {
    throw new Error("Only an approved withdrawal can be paid.");
  }
  if (request.savings_transaction_id) {
    throw new Error("This withdrawal has already been paid.");
  }
  if (!request.savings_account_id || !request.savings_product_id) {
    throw new Error("The withdrawal has no savings account to take the money from.");
  }
  await assertPeriodOpen(input.coopId, input.paymentDate);

  const amount = Number(request.approved_amount ?? request.eligible_amount ?? 0);
  if (amount <= 0) throw new Error("The approved amount must be greater than zero.");

  const { data: account } = await supabase
    .from("member_savings_accounts")
    .select("available_balance, status")
    .eq("id", request.savings_account_id)
    .single();
  const available = Number(account?.available_balance ?? 0);
  if (account?.status !== "ACTIVE") throw new Error("The savings account is not active.");
  if (available + 0.005 < amount) {
    throw new Error("The savings account no longer holds enough money for this withdrawal.");
  }

  const txNumber = await nextTransactionNumber(input.coopId);
  const { data: tx, error: txErr } = await supabase
    .from("savings_transactions")
    .insert({
      cooperative_id: input.coopId,
      member_id: request.member_id,
      savings_account_id: request.savings_account_id,
      savings_product_id: request.savings_product_id,
      transaction_number: txNumber,
      transaction_type: "WITHDRAWAL",
      direction: "DEBIT",
      amount,
      transaction_date: input.paymentDate,
      value_date: input.paymentDate,
      source: "BANK_TRANSFER",
      payment_reference: input.paymentReference,
      description: `Withdrawal ${request.withdrawal_number}`,
      status: "POSTED",
      posted_by: input.userId,
      posted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (txErr) throw txErr;

  const { error: payoutErr } = await supabase.from("withdrawal_payouts").insert({
    cooperative_id: input.coopId,
    withdrawal_request_id: request.id,
    member_id: request.member_id,
    bank_account_id: request.destination_bank_account_id,
    amount: Number(request.net_payout_amount ?? amount),
    payment_reference: input.paymentReference,
    payment_provider: input.paymentProvider,
    bank_reference: input.bankReference,
    status: "SUCCESSFUL",
    initiated_at: new Date().toISOString(),
    processed_at: new Date().toISOString(),
    created_by: input.userId,
    processed_by: input.userId,
  });
  if (payoutErr) throw payoutErr;

  await supabase
    .from("withdrawal_requests")
    .update({
      status: "COMPLETED",
      savings_transaction_id: tx.id,
      processed_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      processed_by: input.userId,
    })
    .eq("id", request.id);

  await releaseHolds(request.id, "CONSUMED", input.userId);
  await notifyMembers(input.coopId, [request.member_id], {
    eventType: "WITHDRAWAL_PAID",
    title: `Withdrawal ${request.withdrawal_number} paid`,
    body: "The money has been sent to your bank account.",
  });
  await notifyStaff({
    cooperativeId: input.coopId,
    eventType: "WITHDRAWAL_PAID",
    title: `Withdrawal ${request.withdrawal_number} paid`,
    link: "/admin/withdrawals",
  });
  return tx.id;
}

export async function recordPayoutFailure(input: {
  coopId: string;
  requestId: string;
  reason: string;
  userId: string | null;
}) {
  const { count } = await supabase
    .from("withdrawal_payouts")
    .select("id", { count: "exact", head: true })
    .eq("withdrawal_request_id", input.requestId);
  await supabase.from("withdrawal_payouts").insert({
    cooperative_id: input.coopId,
    withdrawal_request_id: input.requestId,
    member_id: (
      await supabase.from("withdrawal_requests").select("member_id").eq("id", input.requestId).single()
    ).data!.member_id,
    amount: 0,
    status: "FAILED",
    failure_reason: input.reason,
    retry_count: count ?? 0,
    created_by: input.userId,
  });
  await supabase.from("withdrawal_requests").update({ status: "FAILED" }).eq("id", input.requestId);
  await supabase.from("withdrawal_exceptions").insert({
    cooperative_id: input.coopId,
    withdrawal_request_id: input.requestId,
    severity: "HIGH",
    exception_type: "PAYOUT_FAILED",
    detail: input.reason,
  });
}

/** Reverses a completed withdrawal. The original stays on record for ever. */
export async function reverseWithdrawal(input: {
  coopId: string;
  requestId: string;
  reason: string;
  reversalDate: string;
  userId: string | null;
}) {
  const { data: request, error } = await supabase
    .from("withdrawal_requests")
    .select(
      "id, withdrawal_number, member_id, status, savings_account_id, savings_product_id, approved_amount, eligible_amount, savings_transaction_id",
    )
    .eq("id", input.requestId)
    .single();
  if (error) throw error;
  if (request.status !== "COMPLETED") throw new Error("Only a completed withdrawal can be reversed.");
  await assertPeriodOpen(input.coopId, input.reversalDate);

  const amount = Number(request.approved_amount ?? request.eligible_amount ?? 0);
  const txNumber = await nextTransactionNumber(input.coopId);
  const { error: txErr } = await supabase.from("savings_transactions").insert({
    cooperative_id: input.coopId,
    member_id: request.member_id,
    savings_account_id: request.savings_account_id!,
    savings_product_id: request.savings_product_id!,
    transaction_number: txNumber,
    transaction_type: "REVERSAL",
    direction: "CREDIT",
    amount,
    transaction_date: input.reversalDate,
    value_date: input.reversalDate,
    source: "SYSTEM",
    description: `Reversal of withdrawal ${request.withdrawal_number}: ${input.reason}`,
    status: "POSTED",
    posted_by: input.userId,
    posted_at: new Date().toISOString(),
    reversal_of_transaction_id: request.savings_transaction_id,
    reversal_reason: input.reason,
  });
  if (txErr) throw txErr;

  if (request.savings_transaction_id) {
    await supabase
      .from("savings_transactions")
      .update({ reversed_at: new Date().toISOString(), reversal_reason: input.reason })
      .eq("id", request.savings_transaction_id);
  }

  await supabase
    .from("withdrawal_requests")
    .update({
      status: "REVERSED",
      reversed_at: new Date().toISOString(),
      reversal_reason: input.reason,
    })
    .eq("id", request.id);

  await supabase
    .from("withdrawal_payouts")
    .update({ status: "REVERSED", failure_reason: input.reason })
    .eq("withdrawal_request_id", request.id)
    .eq("status", "SUCCESSFUL");

  await notifyMembers(input.coopId, [request.member_id], {
    eventType: "WITHDRAWAL_REVERSED",
    title: `Withdrawal ${request.withdrawal_number} reversed`,
    body: input.reason,
  });
}

export type ExitCalculation = {
  regularSavings: number;
  specialSavings: number;
  otherBalances: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingFees: number;
  outstandingPenalties: number;
  pledgedBalance: number;
  grossEntitlement: number;
  netSettlement: number;
};

/** Works out what a leaving member is owed, after everything they still owe. */
export async function calculateExitSettlement(
  coopId: string,
  memberId: string,
  exitFee = 0,
): Promise<ExitCalculation> {
  const position = await loadMemberPosition(coopId, memberId, null);
  const { data: loans } = await supabase
    .from("loans")
    .select("outstanding_principal, outstanding_interest, outstanding_fees, outstanding_penalties, status")
    .eq("cooperative_id", coopId)
    .eq("member_id", memberId)
    .in("status", [...LIVE_LOAN_STATUSES]);

  const bucket = (types: string[]) =>
    position.accounts
      .filter((a) => types.includes(a.productType))
      .reduce((s, a) => s + a.currentBalance, 0);

  const regularSavings = bucket(["ORDINARY"]);
  const specialSavings = bucket(["SPECIAL"]);
  const otherBalances = bucket(["INVESTMENT", "OTHER"]);
  const outstandingPrincipal = (loans ?? []).reduce((s, l) => s + Number(l.outstanding_principal ?? 0), 0);
  const outstandingInterest = (loans ?? []).reduce((s, l) => s + Number(l.outstanding_interest ?? 0), 0);
  const outstandingFees = (loans ?? []).reduce((s, l) => s + Number(l.outstanding_fees ?? 0), 0);
  const outstandingPenalties = (loans ?? []).reduce((s, l) => s + Number(l.outstanding_penalties ?? 0), 0);

  const grossEntitlement = regularSavings + specialSavings + otherBalances;
  const obligations =
    outstandingPrincipal + outstandingInterest + outstandingFees + outstandingPenalties + exitFee;

  return {
    regularSavings,
    specialSavings,
    otherBalances,
    outstandingPrincipal,
    outstandingInterest,
    outstandingFees,
    outstandingPenalties,
    pledgedBalance: position.lockedBalance,
    grossEntitlement,
    netSettlement: grossEntitlement - obligations,
  };
}
