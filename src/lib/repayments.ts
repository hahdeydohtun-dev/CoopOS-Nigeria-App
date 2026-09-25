import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { notifyMembers, notifyStaff } from "@/lib/notify";

type Enums = Database["public"]["Enums"];

export type RepaymentSource = Enums["loan_repayment_source"];
export type RepaymentStatus = Enums["loan_repayment_status"];
export type AllocationType = Enums["loan_allocation_type"];
export type AllocationStatus = Enums["loan_allocation_status"];
export type CollectionCaseStatus = Enums["collection_case_status"];
export type CollectionActionType = Enums["collection_action_type"];
export type CollectionPriority = Enums["collection_priority"];
export type PromiseStatus = Enums["promise_status"];
export type LoanRequestStatus = Enums["loan_request_status"];

export const REPAYMENT_SOURCES: RepaymentSource[] = [
  "CHECK_OFF",
  "BANK_TRANSFER",
  "DIRECT_DEBIT",
  "CASH",
  "INTERNAL_TRANSFER",
  "SAVINGS_OFFSET",
  "PORTAL",
  "MANUAL_ADJUSTMENT",
  "GUARANTOR_RECOVERY",
  "RECOVERY_AFTER_WRITE_OFF",
  "OTHER",
];

export const COLLECTION_ACTION_TYPES: CollectionActionType[] = [
  "SMS",
  "EMAIL",
  "PHONE_CALL",
  "REMINDER",
  "MEETING",
  "PAYMENT_REQUEST",
  "PROMISE_TO_PAY",
  "GUARANTOR_CONTACT",
  "EMPLOYER_ESCALATION",
  "COMMITTEE_ESCALATION",
  "RECOVERY_ACTION",
  "LEGAL_REVIEW",
  "OTHER",
];

export const COLLECTION_CASE_STATUSES: CollectionCaseStatus[] = [
  "OPEN",
  "CONTACTED",
  "PROMISE_TO_PAY",
  "ESCALATED",
  "RESTRUCTURING",
  "RECOVERY",
  "LEGAL_REVIEW",
  "RESOLVED",
  "CLOSED",
];

export const COLLECTION_PRIORITIES: CollectionPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function repaymentStatusTone(
  status: RepaymentStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "POSTED") return "default";
  if (status === "REVERSED" || status === "FAILED" || status === "CANCELLED") return "destructive";
  if (status === "UNAPPLIED") return "outline";
  return "secondary";
}

export function priorityTone(
  priority: CollectionPriority,
): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "CRITICAL" || priority === "HIGH") return "destructive";
  if (priority === "MEDIUM") return "secondary";
  return "outline";
}

/* ------------------------------------------------------------------ */
/* Cooperative configuration                                           */
/* ------------------------------------------------------------------ */

export type RepaymentRules = {
  waterfall: AllocationType[];
  graceDays: number;
  nplThreshold: number;
  penaltyRate: number | null;
  penaltyBasis: "OVERDUE_AMOUNT" | "OUTSTANDING_PRINCIPAL";
  overpaymentTreatment: "ADVANCE" | "PRINCIPAL_REDUCTION" | "HOLD";
  dpdBands: { label: string; from: number; to: number | null }[];
};

export const DEFAULT_WATERFALL: AllocationType[] = [
  "PENALTY",
  "PROCESSING_FEE",
  "INTEREST",
  "PRINCIPAL",
];

export const DEFAULT_RULES: RepaymentRules = {
  waterfall: DEFAULT_WATERFALL,
  graceDays: 5,
  nplThreshold: 90,
  penaltyRate: null,
  penaltyBasis: "OVERDUE_AMOUNT",
  overpaymentTreatment: "HOLD",
  dpdBands: [
    { label: "Current", from: 0, to: 0 },
    { label: "1–7 days", from: 1, to: 7 },
    { label: "8–30 days", from: 8, to: 30 },
    { label: "31–60 days", from: 31, to: 60 },
    { label: "61–90 days", from: 61, to: 90 },
    { label: "91–180 days", from: 91, to: 180 },
    { label: "Over 180 days", from: 181, to: null },
  ],
};

export const RULE_KEYS = {
  waterfall: "repayments.allocation_waterfall",
  graceDays: "repayments.grace_days",
  nplThreshold: "repayments.npl_threshold_dpd",
  penaltyRate: "repayments.penalty_rate",
  penaltyBasis: "repayments.penalty_basis",
  overpayment: "repayments.overpayment_treatment",
} as const;

/** Read the cooperative's repayment policy, falling back to the platform defaults. */
export async function loadRepaymentRules(coopId: string): Promise<RepaymentRules> {
  const { data } = await supabase
    .from("cooperative_rules")
    .select("rule_key, numeric_value, text_value, json_value, active")
    .eq("cooperative_id", coopId)
    .eq("active", true)
    .in("rule_key", Object.values(RULE_KEYS));

  const rules: RepaymentRules = { ...DEFAULT_RULES, dpdBands: [...DEFAULT_RULES.dpdBands] };
  for (const row of data ?? []) {
    switch (row.rule_key) {
      case RULE_KEYS.waterfall: {
        const order = Array.isArray(row.json_value)
          ? (row.json_value as unknown[]).map(String)
          : String(row.text_value ?? "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
        const valid = order.filter((o): o is AllocationType =>
          ["PENALTY", "PROCESSING_FEE", "ADMIN_FEE", "INSURANCE", "INTEREST", "PRINCIPAL", "OTHER"].includes(o),
        );
        if (valid.length > 0) rules.waterfall = valid;
        break;
      }
      case RULE_KEYS.graceDays:
        if (row.numeric_value !== null) rules.graceDays = Number(row.numeric_value);
        break;
      case RULE_KEYS.nplThreshold:
        if (row.numeric_value !== null) rules.nplThreshold = Number(row.numeric_value);
        break;
      case RULE_KEYS.penaltyRate:
        if (row.numeric_value !== null) rules.penaltyRate = Number(row.numeric_value);
        break;
      case RULE_KEYS.penaltyBasis:
        if (row.text_value === "OUTSTANDING_PRINCIPAL") rules.penaltyBasis = "OUTSTANDING_PRINCIPAL";
        break;
      case RULE_KEYS.overpayment:
        if (row.text_value === "ADVANCE" || row.text_value === "PRINCIPAL_REDUCTION")
          rules.overpaymentTreatment = row.text_value;
        break;
      default:
        break;
    }
  }
  return rules;
}

export async function saveRepaymentRule(args: {
  coopId: string;
  key: string;
  name: string;
  numeric?: number | null;
  text?: string | null;
  json?: unknown;
}) {
  const { data: existing } = await supabase
    .from("cooperative_rules")
    .select("id")
    .eq("cooperative_id", args.coopId)
    .eq("rule_key", args.key)
    .maybeSingle();

  const payload = {
    cooperative_id: args.coopId,
    rule_key: args.key,
    rule_name: args.name,
    category: "REPAYMENTS",
    value_type: (args.json !== undefined
      ? "JSON"
      : args.text !== undefined && args.text !== null
        ? "TEXT"
        : "NUMERIC") as Enums["rule_value_type"],
    numeric_value: args.numeric ?? null,
    text_value: args.text ?? null,
    json_value: (args.json ?? null) as never,
    active: true,
  };

  if (existing?.id) {
    const { error } = await supabase.from("cooperative_rules").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("cooperative_rules").insert(payload);
    if (error) throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Schedule, arrears and delinquency maths                             */
/* ------------------------------------------------------------------ */

export type ScheduleLineRow = {
  id: string;
  installment_number: number;
  due_date: string;
  principal: number;
  interest: number;
  fees: number;
  total_due: number;
  paid_principal: number;
  paid_interest: number;
  paid_fees: number;
  status: string | null;
};

export type LineOutstanding = {
  line: ScheduleLineRow;
  principal: number;
  interest: number;
  fees: number;
  total: number;
  daysOverdue: number;
};

export function daysBetween(from: string, to: Date = new Date()): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((b - a) / 86400000);
}

export function lineOutstanding(line: ScheduleLineRow, today = new Date()): LineOutstanding {
  const principal = Math.max(0, round2(Number(line.principal) - Number(line.paid_principal)));
  const interest = Math.max(0, round2(Number(line.interest) - Number(line.paid_interest)));
  const fees = Math.max(0, round2(Number(line.fees) - Number(line.paid_fees)));
  return {
    line,
    principal,
    interest,
    fees,
    total: round2(principal + interest + fees),
    daysOverdue: Math.max(0, daysBetween(line.due_date, today)),
  };
}

export type ArrearsSummary = {
  principalArrears: number;
  interestArrears: number;
  feeArrears: number;
  totalArrears: number;
  daysPastDue: number;
  earliestOverdueDate: string | null;
  amountDueToDate: number;
  nextDueDate: string | null;
  nextDueAmount: number;
};

/** Arrears and days past due, measured from the earliest unpaid due date. */
export function summariseArrears(
  lines: ScheduleLineRow[],
  graceDays = 0,
  today = new Date(),
): ArrearsSummary {
  let principalArrears = 0;
  let interestArrears = 0;
  let feeArrears = 0;
  let amountDueToDate = 0;
  let earliest: string | null = null;
  let nextDueDate: string | null = null;
  let nextDueAmount = 0;

  const sorted = [...lines].sort((a, b) => a.due_date.localeCompare(b.due_date));
  for (const line of sorted) {
    const o = lineOutstanding(line, today);
    if (o.total <= 0) continue;
    if (o.daysOverdue > graceDays) {
      principalArrears += o.principal;
      interestArrears += o.interest;
      feeArrears += o.fees;
      amountDueToDate += o.total;
      if (!earliest) earliest = line.due_date;
    } else if (!nextDueDate) {
      nextDueDate = line.due_date;
      nextDueAmount = o.total;
    }
  }

  const daysPastDue = earliest ? Math.max(0, daysBetween(earliest, today)) : 0;
  return {
    principalArrears: round2(principalArrears),
    interestArrears: round2(interestArrears),
    feeArrears: round2(feeArrears),
    totalArrears: round2(principalArrears + interestArrears + feeArrears),
    daysPastDue,
    earliestOverdueDate: earliest,
    amountDueToDate: round2(amountDueToDate),
    nextDueDate,
    nextDueAmount: round2(nextDueAmount),
  };
}

export function delinquencyBand(dpd: number, rules: RepaymentRules): string {
  if (dpd <= 0) return "Current";
  if (dpd <= rules.graceDays) return "Grace";
  const band = rules.dpdBands.find((b) => dpd >= b.from && (b.to === null || dpd <= b.to));
  return band?.label ?? "Current";
}

export function parBucket(dpd: number): string {
  if (dpd >= 90) return "PAR 90";
  if (dpd >= 60) return "PAR 60";
  if (dpd >= 30) return "PAR 30";
  if (dpd >= 1) return "PAR 1";
  return "Current";
}

/** Penalty for one overdue period, using the product/cooperative configuration. */
export function calculatePenalty(args: {
  overdueAmount: number;
  outstandingPrincipal: number;
  annualPenaltyRate: number;
  daysOverdue: number;
  graceDays: number;
  basis: RepaymentRules["penaltyBasis"];
  cap?: number | null;
}): { amount: number; methodology: string } {
  const chargeableDays = Math.max(0, args.daysOverdue - args.graceDays);
  const base = args.basis === "OUTSTANDING_PRINCIPAL" ? args.outstandingPrincipal : args.overdueAmount;
  if (chargeableDays === 0 || base <= 0 || args.annualPenaltyRate <= 0) {
    return { amount: 0, methodology: "No penalty: within grace period or no configured rate." };
  }
  const raw = (base * (args.annualPenaltyRate / 100) * chargeableDays) / 365;
  const amount = args.cap ? Math.min(round2(raw), args.cap) : round2(raw);
  return {
    amount,
    methodology: `${args.annualPenaltyRate}% a year on ${
      args.basis === "OUTSTANDING_PRINCIPAL" ? "outstanding principal" : "the overdue amount"
    } of ${base.toFixed(2)} for ${chargeableDays} day(s) beyond ${args.graceDays} grace day(s).`,
  };
}

/* ------------------------------------------------------------------ */
/* Allocation engine                                                   */
/* ------------------------------------------------------------------ */

export type PlannedAllocation = {
  scheduleLineId: string | null;
  installmentNumber: number | null;
  allocationType: AllocationType;
  amount: number;
};

export type AllocationPlan = {
  allocations: PlannedAllocation[];
  allocated: number;
  unapplied: number;
  principal: number;
  interest: number;
  fees: number;
  penalty: number;
};

/**
 * Spread a payment across outstanding instalments following the cooperative's
 * waterfall. Oldest instalment first; anything left over is unapplied.
 */
export function planAllocation(args: {
  amount: number;
  lines: ScheduleLineRow[];
  waterfall?: AllocationType[];
  outstandingPenalties?: number;
  today?: Date;
}): AllocationPlan {
  const waterfall = args.waterfall?.length ? args.waterfall : DEFAULT_WATERFALL;
  let remaining = round2(args.amount);
  const allocations: PlannedAllocation[] = [];
  const totals = { principal: 0, interest: 0, fees: 0, penalty: 0 };

  const take = (
    available: number,
    type: AllocationType,
    scheduleLineId: string | null,
    installmentNumber: number | null,
  ) => {
    if (remaining <= 0 || available <= 0) return;
    const amount = round2(Math.min(remaining, available));
    remaining = round2(remaining - amount);
    allocations.push({ scheduleLineId, installmentNumber, allocationType: type, amount });
    if (type === "PRINCIPAL") totals.principal = round2(totals.principal + amount);
    else if (type === "INTEREST") totals.interest = round2(totals.interest + amount);
    else if (type === "PENALTY") totals.penalty = round2(totals.penalty + amount);
    else totals.fees = round2(totals.fees + amount);
  };

  // Penalties sit on the loan rather than on an instalment.
  if (waterfall.includes("PENALTY")) {
    take(round2(args.outstandingPenalties ?? 0), "PENALTY", null, null);
  }

  const sorted = [...args.lines]
    .map((l) => lineOutstanding(l, args.today ?? new Date()))
    .filter((o) => o.total > 0)
    .sort((a, b) => a.line.due_date.localeCompare(b.line.due_date));

  for (const o of sorted) {
    if (remaining <= 0) break;
    for (const type of waterfall) {
      if (remaining <= 0) break;
      if (type === "PENALTY") continue;
      if (type === "INTEREST") take(o.interest, "INTEREST", o.line.id, o.line.installment_number);
      else if (type === "PRINCIPAL") take(o.principal, "PRINCIPAL", o.line.id, o.line.installment_number);
      else take(o.fees, type, o.line.id, o.line.installment_number);
    }
  }

  return {
    allocations,
    allocated: round2(args.amount - remaining),
    unapplied: round2(remaining),
    ...totals,
  };
}

/* ------------------------------------------------------------------ */
/* Posting                                                             */
/* ------------------------------------------------------------------ */

export type PostRepaymentInput = {
  coopId: string;
  loanId: string;
  memberId: string | null;
  amount: number;
  repaymentDate: string;
  source: RepaymentSource;
  method?: string | null;
  externalReference?: string | null;
  checkoffBatchId?: string | null;
  checkoffLineId?: string | null;
  expectedAmount?: number | null;
  notes?: string | null;
  userId?: string | null;
};

export type PostRepaymentResult = {
  repaymentId: string;
  repaymentNumber: string;
  plan: AllocationPlan;
};

export async function nextRepaymentNumber(coopId: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_loan_repayment_number", {
    _cooperative_id: coopId,
  });
  if (error) throw error;
  return data as string;
}

/** Period must be open before any money is posted into it. */
export async function assertPeriodOpen(coopId: string, date: string) {
  const { data } = await supabase
    .from("accounting_periods")
    .select("name, status, start_date, end_date")
    .eq("cooperative_id", coopId)
    .lte("start_date", date)
    .gte("end_date", date)
    .maybeSingle();
  if (data && data.status === "CLOSED") {
    throw new Error(`The accounting period ${data.name} is closed, so nothing can be posted into it.`);
  }
}

async function duplicateExists(input: PostRepaymentInput): Promise<boolean> {
  if (input.checkoffLineId) {
    const { data } = await supabase
      .from("loan_repayments")
      .select("id")
      .eq("checkoff_line_id", input.checkoffLineId)
      .neq("status", "REVERSED")
      .maybeSingle();
    if (data) return true;
  }
  if (input.externalReference) {
    const { data } = await supabase
      .from("loan_repayments")
      .select("id")
      .eq("cooperative_id", input.coopId)
      .eq("payment_source", input.source)
      .eq("external_reference", input.externalReference)
      .neq("status", "REVERSED")
      .maybeSingle();
    if (data) return true;
  }
  const { data: same } = await supabase
    .from("loan_repayments")
    .select("id")
    .eq("cooperative_id", input.coopId)
    .eq("loan_id", input.loanId)
    .eq("amount", input.amount)
    .eq("repayment_date", input.repaymentDate)
    .eq("payment_source", input.source)
    .eq("status", "POSTED")
    .maybeSingle();
  return Boolean(same);
}

/**
 * Record and post a repayment: allocate it across the active schedule, write the
 * immutable loan entries, update the instalments and tell the member.
 */
export async function postRepayment(input: PostRepaymentInput): Promise<PostRepaymentResult> {
  if (!(input.amount > 0)) throw new Error("A repayment must be more than zero.");
  await assertPeriodOpen(input.coopId, input.repaymentDate);

  if (await duplicateExists(input)) {
    throw new Error("This payment has already been recorded. Check the repayment list before posting again.");
  }

  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("id, loan_number, member_id, status, outstanding_penalties, schedule_version")
    .eq("id", input.loanId)
    .single();
  if (loanError) throw loanError;
  if (!["ACTIVE", "RESTRUCTURED", "DEFAULTED"].includes(String(loan.status))) {
    throw new Error("Only a live loan can take a repayment.");
  }

  const { data: schedule } = await supabase
    .from("loan_schedules")
    .select("id")
    .eq("loan_id", input.loanId)
    .eq("status", "ACTIVE")
    .order("schedule_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: lineRows } = schedule
    ? await supabase
        .from("loan_schedule_lines")
        .select(
          "id, installment_number, due_date, principal, interest, fees, total_due, paid_principal, paid_interest, paid_fees, status",
        )
        .eq("schedule_id", schedule.id)
        .order("installment_number")
    : { data: [] as ScheduleLineRow[] };

  const rules = await loadRepaymentRules(input.coopId);
  const plan = planAllocation({
    amount: input.amount,
    lines: (lineRows ?? []) as ScheduleLineRow[],
    waterfall: rules.waterfall,
    outstandingPenalties: Number(loan.outstanding_penalties ?? 0),
  });

  const repaymentNumber = await nextRepaymentNumber(input.coopId);
  const memberId = input.memberId ?? loan.member_id;
  const expected = input.expectedAmount ?? null;

  const { data: repayment, error: repaymentError } = await supabase
    .from("loan_repayments")
    .insert({
      cooperative_id: input.coopId,
      repayment_number: repaymentNumber,
      loan_id: input.loanId,
      member_id: memberId,
      repayment_date: input.repaymentDate,
      value_date: input.repaymentDate,
      posting_date: new Date().toISOString().slice(0, 10),
      amount: input.amount,
      payment_source: input.source,
      payment_method: input.method ?? null,
      external_reference: input.externalReference ?? null,
      checkoff_batch_id: input.checkoffBatchId ?? null,
      checkoff_line_id: input.checkoffLineId ?? null,
      expected_amount: expected,
      variance_amount: expected === null ? null : round2(input.amount - expected),
      status: "PENDING",
      allocation_status: "UNALLOCATED",
      notes: input.notes ?? null,
      created_by: input.userId ?? null,
    })
    .select("id")
    .single();
  if (repaymentError) throw repaymentError;

  if (plan.allocations.length > 0) {
    const { error: allocError } = await supabase.from("loan_repayment_allocations").insert(
      plan.allocations.map((a, index) => ({
        cooperative_id: input.coopId,
        repayment_id: repayment.id,
        loan_id: input.loanId,
        schedule_line_id: a.scheduleLineId,
        allocation_type: a.allocationType,
        amount: a.amount,
        allocation_sequence: index + 1,
        allocation_date: input.repaymentDate,
        created_by: input.userId ?? null,
      })),
    );
    if (allocError) throw allocError;
  }

  // Immutable loan ledger entries, one per component that actually moved.
  const allComponents: {
    type: Database["public"]["Enums"]["loan_transaction_type"];
    amount: number;
    field: string;
  }[] = [
    { type: "PENALTY_REPAYMENT", amount: plan.penalty, field: "penalty_component" },
    { type: "FEE_REPAYMENT", amount: plan.fees, field: "fee_component" },
    { type: "INTEREST_REPAYMENT", amount: plan.interest, field: "interest_component" },
    { type: "PRINCIPAL_REPAYMENT", amount: plan.principal, field: "principal_component" },
  ];
  const components = allComponents.filter((c) => c.amount > 0);

  let seq = 1;
  for (const c of components) {
    const { error } = await supabase.from("loan_transactions").insert({
      cooperative_id: input.coopId,
      loan_id: input.loanId,
      member_id: memberId,
      transaction_number: `${loan.loan_number}-${repaymentNumber}-${seq}`,
      transaction_type: c.type,
      status: "POSTED",
      amount: c.amount,
      principal_component: c.field === "principal_component" ? c.amount : 0,
      interest_component: c.field === "interest_component" ? c.amount : 0,
      fee_component: c.field === "fee_component" ? c.amount : 0,
      penalty_component: c.field === "penalty_component" ? c.amount : 0,
      transaction_date: input.repaymentDate,
      posting_date: new Date().toISOString().slice(0, 10),
      reference: repaymentNumber,
      source: input.source,
      narration: `Repayment ${repaymentNumber}`,
      created_by: input.userId ?? null,
    });
    if (error) throw error;
    seq += 1;
  }

  // Update the instalments that were paid.
  const byLine = new Map<string, { principal: number; interest: number; fees: number }>();
  for (const a of plan.allocations) {
    if (!a.scheduleLineId) continue;
    const current = byLine.get(a.scheduleLineId) ?? { principal: 0, interest: 0, fees: 0 };
    if (a.allocationType === "PRINCIPAL") current.principal += a.amount;
    else if (a.allocationType === "INTEREST") current.interest += a.amount;
    else current.fees += a.amount;
    byLine.set(a.scheduleLineId, current);
  }
  for (const [lineId, paid] of byLine) {
    const original = (lineRows ?? []).find((l) => l.id === lineId) as ScheduleLineRow | undefined;
    if (!original) continue;
    const paidPrincipal = round2(Number(original.paid_principal) + paid.principal);
    const paidInterest = round2(Number(original.paid_interest) + paid.interest);
    const paidFees = round2(Number(original.paid_fees) + paid.fees);
    const settled =
      paidPrincipal >= Number(original.principal) - 0.01 &&
      paidInterest >= Number(original.interest) - 0.01 &&
      paidFees >= Number(original.fees) - 0.01;
    await supabase
      .from("loan_schedule_lines")
      .update({
        paid_principal: paidPrincipal,
        paid_interest: paidInterest,
        paid_fees: paidFees,
        status: settled ? "PAID" : "PARTIALLY_PAID",
      })
      .eq("id", lineId);
  }

  await supabase
    .from("loan_repayments")
    .update({
      status: "POSTED",
      allocation_status:
        plan.unapplied <= 0 ? "FULLY_ALLOCATED" : plan.allocated > 0 ? "PARTIALLY_ALLOCATED" : "UNALLOCATED",
      allocated_amount: plan.allocated,
      unapplied_amount: plan.unapplied,
      posted_by: input.userId ?? null,
    })
    .eq("id", repayment.id);

  if (plan.unapplied > 0) {
    await supabase.from("unapplied_loan_payments").insert({
      cooperative_id: input.coopId,
      repayment_id: repayment.id,
      member_id: memberId,
      loan_id: input.loanId,
      amount: plan.unapplied,
      received_date: input.repaymentDate,
      payment_source: input.source,
      reference: input.externalReference ?? repaymentNumber,
      reason: "OVERPAYMENT",
      created_by: input.userId ?? null,
    });
  }

  // Close the loan when nothing is left owing.
  const { data: refreshed } = await supabase
    .from("loans")
    .select("total_outstanding")
    .eq("id", input.loanId)
    .maybeSingle();
  if (refreshed && Number(refreshed.total_outstanding) <= 0.01) {
    await supabase.from("loans").update({ status: "CLOSED" }).eq("id", input.loanId);
  }

  if (memberId) {
    await notifyMembers(input.coopId, [memberId], {
      eventType: "LOAN_REPAYMENT",
      title: `Repayment of ${input.amount.toLocaleString("en-NG", { style: "currency", currency: "NGN" })} received`,
      body: `Receipt ${repaymentNumber} has been applied to loan ${loan.loan_number}.`,
    });
  }
  await notifyStaff({
    cooperativeId: input.coopId,
    eventType: "LOAN_REPAYMENT",
    title: `Repayment ${repaymentNumber} posted`,
    body: `Loan ${loan.loan_number}; ${plan.unapplied > 0 ? "part of the money is unapplied." : "fully allocated."}`,
    link: "/admin/repayments",
    severity: plan.unapplied > 0 ? "ACTION" : "INFO",
  });

  return { repaymentId: repayment.id, repaymentNumber, plan };
}

/** Reverse a posted repayment: nothing is deleted, the entries are mirrored back. */
export async function reverseRepayment(args: {
  coopId: string;
  repaymentId: string;
  reason: string;
  userId?: string | null;
}) {
  const { data: repayment, error } = await supabase
    .from("loan_repayments")
    .select("id, repayment_number, loan_id, member_id, amount, status, repayment_date, payment_source")
    .eq("id", args.repaymentId)
    .single();
  if (error) throw error;
  if (repayment.status !== "POSTED") throw new Error("Only a posted repayment can be reversed.");
  if (!repayment.loan_id) throw new Error("This payment is not attached to a loan.");

  const { data: allocations } = await supabase
    .from("loan_repayment_allocations")
    .select("schedule_line_id, allocation_type, amount")
    .eq("repayment_id", args.repaymentId);

  const { data: loan } = await supabase
    .from("loans")
    .select("loan_number")
    .eq("id", repayment.loan_id)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const totals = { principal: 0, interest: 0, fees: 0, penalty: 0 };
  for (const a of allocations ?? []) {
    const amount = Number(a.amount);
    if (a.allocation_type === "PRINCIPAL") totals.principal += amount;
    else if (a.allocation_type === "INTEREST") totals.interest += amount;
    else if (a.allocation_type === "PENALTY") totals.penalty += amount;
    else totals.fees += amount;
  }

  await supabase.from("loan_transactions").insert({
    cooperative_id: args.coopId,
    loan_id: repayment.loan_id,
    member_id: repayment.member_id as string,
    transaction_number: `${loan?.loan_number ?? "LN"}-${repayment.repayment_number}-REV`,
    transaction_type: "REVERSAL",
    status: "POSTED",
    amount: Number(repayment.amount),
    principal_component: totals.principal,
    interest_component: totals.interest,
    fee_component: totals.fees,
    penalty_component: totals.penalty,
    transaction_date: today,
    posting_date: today,
    reference: repayment.repayment_number,
    source: repayment.payment_source,
    narration: `Reversal of ${repayment.repayment_number}: ${args.reason}`,
    reversal_reason: args.reason,
    created_by: args.userId ?? null,
  });

  // Reversal entries restore the balance, so re-apply the components as debits.
  await supabase.from("loan_transactions").insert({
    cooperative_id: args.coopId,
    loan_id: repayment.loan_id,
    member_id: repayment.member_id as string,
    transaction_number: `${loan?.loan_number ?? "LN"}-${repayment.repayment_number}-REVADJ`,
    transaction_type: "ADJUSTMENT_DEBIT",
    status: "POSTED",
    amount: Number(repayment.amount),
    principal_component: totals.principal,
    interest_component: 0,
    fee_component: 0,
    penalty_component: 0,
    transaction_date: today,
    posting_date: today,
    reference: repayment.repayment_number,
    source: repayment.payment_source,
    narration: `Balance restored after reversing ${repayment.repayment_number}`,
    created_by: args.userId ?? null,
  });

  // Put the instalments back.
  for (const a of allocations ?? []) {
    if (!a.schedule_line_id) continue;
    const { data: line } = await supabase
      .from("loan_schedule_lines")
      .select("id, principal, interest, fees, paid_principal, paid_interest, paid_fees")
      .eq("id", a.schedule_line_id)
      .maybeSingle();
    if (!line) continue;
    const amount = Number(a.amount);
    const update: {
      paid_principal?: number;
      paid_interest?: number;
      paid_fees?: number;
      status: string;
    } = { status: "PARTIALLY_PAID" };
    if (a.allocation_type === "PRINCIPAL")
      update.paid_principal = Math.max(0, round2(Number(line.paid_principal) - amount));
    else if (a.allocation_type === "INTEREST")
      update.paid_interest = Math.max(0, round2(Number(line.paid_interest) - amount));
    else update.paid_fees = Math.max(0, round2(Number(line.paid_fees) - amount));
    await supabase.from("loan_schedule_lines").update(update).eq("id", a.schedule_line_id);
  }

  await supabase
    .from("loan_repayments")
    .update({ status: "REVERSED", reversal_reason: args.reason })
    .eq("id", args.repaymentId);

  await supabase
    .from("unapplied_loan_payments")
    .update({ status: "CANCELLED", resolution: "Repayment reversed" })
    .eq("repayment_id", args.repaymentId);

  if (repayment.member_id) {
    await notifyMembers(args.coopId, [repayment.member_id], {
      eventType: "LOAN_REPAYMENT_REVERSED",
      title: `Repayment ${repayment.repayment_number} reversed`,
      body: args.reason,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Settlement quote                                                    */
/* ------------------------------------------------------------------ */

export type SettlementQuote = {
  outstandingPrincipal: number;
  accruedInterest: number;
  outstandingFees: number;
  outstandingPenalties: number;
  grossInterestRefund: number;
  applicableCharges: number;
  netInterestRefund: number;
  settlementAmount: number;
  policyBasis: string;
};

/** Early settlement figures from the loan's own balances and unexpired interest. */
export function calculateSettlement(args: {
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingFees: number;
  outstandingPenalties: number;
  unexpiredInterest: number;
  refundAllowed: boolean;
  chargePercent: number;
}): SettlementQuote {
  const gross = args.refundAllowed ? round2(args.unexpiredInterest) : 0;
  const charges = round2((gross * args.chargePercent) / 100);
  const net = round2(Math.max(0, gross - charges));
  const settlement = round2(
    Math.max(
      0,
      args.outstandingPrincipal + args.outstandingInterest + args.outstandingFees + args.outstandingPenalties - net,
    ),
  );
  return {
    outstandingPrincipal: round2(args.outstandingPrincipal),
    accruedInterest: round2(args.outstandingInterest),
    outstandingFees: round2(args.outstandingFees),
    outstandingPenalties: round2(args.outstandingPenalties),
    grossInterestRefund: gross,
    applicableCharges: charges,
    netInterestRefund: net,
    settlementAmount: settlement,
    policyBasis: args.refundAllowed
      ? `Unexpired interest refunded less ${args.chargePercent}% administration charge.`
      : "This product does not refund unexpired interest on early settlement.",
  };
}

/** Interest not yet reached on instalments still in the future. */
export function unexpiredInterest(lines: ScheduleLineRow[], today = new Date()): number {
  return round2(
    lines
      .filter((l) => daysBetween(l.due_date, today) < 0)
      .reduce((s, l) => s + Math.max(0, Number(l.interest) - Number(l.paid_interest)), 0),
  );
}

/* ------------------------------------------------------------------ */
/* Collection priority                                                 */
/* ------------------------------------------------------------------ */

export function collectionPriority(args: {
  daysPastDue: number;
  arrears: number;
  outstanding: number;
  missedInstallments: number;
}): CollectionPriority {
  let score = 0;
  if (args.daysPastDue > 90) score += 4;
  else if (args.daysPastDue > 60) score += 3;
  else if (args.daysPastDue > 30) score += 2;
  else if (args.daysPastDue > 0) score += 1;
  if (args.outstanding > 0 && args.arrears / args.outstanding > 0.25) score += 2;
  if (args.missedInstallments >= 3) score += 2;
  else if (args.missedInstallments === 2) score += 1;
  if (score >= 6) return "CRITICAL";
  if (score >= 4) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
}

export async function nextCaseNumber(coopId: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_collection_case_number", {
    _cooperative_id: coopId,
  });
  if (error) throw error;
  return data as string;
}

/* ------------------------------------------------------------------ */
/* Portfolio loading                                                   */
/* ------------------------------------------------------------------ */

export type LoanPortfolioRow = {
  loanId: string;
  loanNumber: string;
  memberId: string | null;
  memberName: string;
  memberNumber: string;
  productName: string;
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingFees: number;
  outstandingPenalties: number;
  totalOutstanding: number;
  status: string;
  arrears: ArrearsSummary;
  missedInstallments: number;
  parBucket: string;
  band: string;
  npl: boolean;
};

/** Every live loan with its arrears position, worked out from the active schedule. */
export async function loadPortfolio(
  coopId: string,
  rules: RepaymentRules,
): Promise<LoanPortfolioRow[]> {
  const { data: loans, error } = await supabase
    .from("loans")
    .select(
      "id, loan_number, member_id, status, outstanding_principal, outstanding_interest, outstanding_fees, outstanding_penalties, total_outstanding, members(first_name, last_name, member_number), loan_products(product_name)",
    )
    .eq("cooperative_id", coopId)
    .in("status", ["ACTIVE", "RESTRUCTURED", "DEFAULTED"]);
  if (error) throw error;
  if (!loans || loans.length === 0) return [];

  const loanIds = loans.map((l) => l.id);
  const { data: schedules } = await supabase
    .from("loan_schedules")
    .select("id, loan_id, schedule_version")
    .in("loan_id", loanIds)
    .eq("status", "ACTIVE");

  const scheduleByLoan = new Map<string, string>();
  for (const s of schedules ?? []) if (s.loan_id) scheduleByLoan.set(s.loan_id, s.id);

  const scheduleIds = Array.from(scheduleByLoan.values());
  const { data: lines } = scheduleIds.length
    ? await supabase
        .from("loan_schedule_lines")
        .select(
          "id, schedule_id, installment_number, due_date, principal, interest, fees, total_due, paid_principal, paid_interest, paid_fees, status",
        )
        .in("schedule_id", scheduleIds)
    : { data: [] as (ScheduleLineRow & { schedule_id: string })[] };

  const linesBySchedule = new Map<string, ScheduleLineRow[]>();
  for (const l of (lines ?? []) as (ScheduleLineRow & { schedule_id: string })[]) {
    const list = linesBySchedule.get(l.schedule_id) ?? [];
    list.push(l);
    linesBySchedule.set(l.schedule_id, list);
  }

  return loans.map((loan) => {
    const scheduleId = scheduleByLoan.get(loan.id);
    const loanLines = scheduleId ? (linesBySchedule.get(scheduleId) ?? []) : [];
    const arrears = summariseArrears(loanLines, rules.graceDays);
    const missed = loanLines.filter(
      (l) => lineOutstanding(l).total > 0 && daysBetween(l.due_date) > rules.graceDays,
    ).length;
    const m = loan.members as { first_name?: string; last_name?: string; member_number?: string } | null;
    return {
      loanId: loan.id,
      loanNumber: loan.loan_number,
      memberId: loan.member_id,
      memberName: [m?.first_name, m?.last_name].filter(Boolean).join(" ") || "—",
      memberNumber: m?.member_number ?? "",
      productName: (loan.loan_products as { product_name?: string } | null)?.product_name ?? "",
      outstandingPrincipal: Number(loan.outstanding_principal ?? 0),
      outstandingInterest: Number(loan.outstanding_interest ?? 0),
      outstandingFees: Number(loan.outstanding_fees ?? 0),
      outstandingPenalties: Number(loan.outstanding_penalties ?? 0),
      totalOutstanding: Number(loan.total_outstanding ?? 0),
      status: String(loan.status),
      arrears,
      missedInstallments: missed,
      parBucket: parBucket(arrears.daysPastDue),
      band: delinquencyBand(arrears.daysPastDue, rules),
      npl: arrears.daysPastDue >= rules.nplThreshold,
    };
  });
}

export type PortfolioKpis = {
  totalOutstanding: number;
  totalArrears: number;
  overdueLoans: number;
  par1: number;
  par30: number;
  par60: number;
  par90: number;
  nplAmount: number;
  nplRate: number;
};

export function portfolioKpis(rows: LoanPortfolioRow[]): PortfolioKpis {
  const total = rows.reduce((s, r) => s + r.totalOutstanding, 0);
  const atLeast = (dpd: number) =>
    rows.filter((r) => r.arrears.daysPastDue >= dpd).reduce((s, r) => s + r.outstandingPrincipal, 0);
  const npl = rows.filter((r) => r.npl).reduce((s, r) => s + r.totalOutstanding, 0);
  return {
    totalOutstanding: round2(total),
    totalArrears: round2(rows.reduce((s, r) => s + r.arrears.totalArrears, 0)),
    overdueLoans: rows.filter((r) => r.arrears.daysPastDue > 0).length,
    par1: round2(atLeast(1)),
    par30: round2(atLeast(30)),
    par60: round2(atLeast(60)),
    par90: round2(atLeast(90)),
    nplAmount: round2(npl),
    nplRate: total > 0 ? round2((npl / total) * 100) : 0,
  };
}

export function percentOf(part: number, whole: number): string {
  if (whole <= 0) return "0.0%";
  return `${((part / whole) * 100).toFixed(1)}%`;
}
