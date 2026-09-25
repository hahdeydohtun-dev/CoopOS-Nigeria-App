import { supabase } from "@/integrations/supabase/client";
import {
  affordablePrincipal,
  buildSchedule,
  processingFee,
  tenureInMonths,
  type LoanEligibilityStatus,
  type LoanFeeType,
  type LoanInterestMethod,
  type LoanTenureUnit,
  type RepaymentFrequency,
  type ScheduleResult,
} from "@/lib/loans";

export type LoanProductRow = {
  id: string;
  cooperative_id: string;
  product_code: string;
  product_name: string;
  description: string | null;
  loan_category: string | null;
  status: string;
  minimum_amount: number;
  maximum_amount: number | null;
  minimum_tenure: number;
  maximum_tenure: number;
  tenure_unit: LoanTenureUnit;
  repayment_frequency: RepaymentFrequency;
  interest_method: LoanInterestMethod;
  interest_rate: number;
  interest_rate_type: string;
  processing_fee_type: LoanFeeType;
  processing_fee_value: number;
  grace_period: number;
  minimum_membership_months: number;
  minimum_savings_months: number;
  savings_multiplier: number | null;
  special_savings_waiting_period: number;
  maximum_debt_to_income_ratio: number | null;
  maximum_installment_to_income_ratio: number | null;
  guarantor_required: boolean;
  minimum_guarantors: number;
  maximum_guarantors: number;
  collateral_required: boolean;
  self_guarantee_allowed: boolean;
  requires_credit_assessment: boolean;
  requires_committee_approval: boolean;
  is_sample: boolean;
};

export type MemberFinancialPosition = {
  memberId: string;
  membershipMonths: number;
  contributionMonths: number;
  netSavings: number;
  netSalary: number;
  existingLoanExposure: number;
  guaranteeExposure: number;
  lifecycleStatus: string | null;
};

function monthsBetween(from: string | null | undefined): number {
  if (!from) return 0;
  const start = new Date(from);
  const now = new Date();
  return Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()),
  );
}

/** Live figures for a member, read from the existing savings, employment and loan records. */
export async function loadMemberPosition(
  coopId: string,
  memberId: string,
): Promise<MemberFinancialPosition> {
  const [member, accounts, employment, loans, guarantees] = await Promise.all([
    supabase
      .from("members")
      .select("id, join_date, lifecycle_status")
      .eq("id", memberId)
      .maybeSingle(),
    supabase
      .from("member_savings_accounts")
      .select("current_balance, savings_products!inner(loan_eligibility_enabled)")
      .eq("cooperative_id", coopId)
      .eq("member_id", memberId),
    supabase
      .from("member_employment")
      .select("net_salary, monthly_salary")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("loans")
      .select("total_outstanding, status")
      .eq("cooperative_id", coopId)
      .eq("member_id", memberId),
    supabase
      .from("loan_guarantors")
      .select("amount_guaranteed, status")
      .eq("cooperative_id", coopId)
      .eq("guarantor_member_id", memberId),
  ]);

  const netSavings = (accounts.data ?? []).reduce((sum, row) => {
    const product = (row as Record<string, unknown>)["savings_products"] as
      | { loan_eligibility_enabled?: boolean }
      | null;
    if (product && product.loan_eligibility_enabled === false) return sum;
    return sum + Number((row as Record<string, unknown>)["current_balance"] ?? 0);
  }, 0);

  const emp = (employment.data ?? [])[0] as Record<string, unknown> | undefined;
  const netSalary = Number(emp?.["net_salary"] ?? emp?.["monthly_salary"] ?? 0);

  const existingLoanExposure = (loans.data ?? [])
    .filter((l) => ["ACTIVE", "PENDING_DISBURSEMENT", "RESTRUCTURED", "DEFAULTED"].includes(
      String((l as Record<string, unknown>)["status"]),
    ))
    .reduce((s, l) => s + Number((l as Record<string, unknown>)["total_outstanding"] ?? 0), 0);

  const guaranteeExposure = (guarantees.data ?? [])
    .filter((g) => String((g as Record<string, unknown>)["status"]) === "ACCEPTED")
    .reduce((s, g) => s + Number((g as Record<string, unknown>)["amount_guaranteed"] ?? 0), 0);

  // contribution months: distinct months with a posted savings credit
  const { data: txns } = await supabase
    .from("savings_transactions")
    .select("value_date, transaction_date, status, direction")
    .eq("cooperative_id", coopId)
    .eq("member_id", memberId)
    .eq("status", "POSTED")
    .eq("direction", "CREDIT")
    .limit(1000);
  const months = new Set<string>();
  for (const t of txns ?? []) {
    const row = t as Record<string, unknown>;
    const d = String(row["value_date"] ?? row["transaction_date"] ?? "");
    if (d) months.add(d.slice(0, 7));
  }

  const m = member.data as Record<string, unknown> | null;
  return {
    memberId,
    membershipMonths: monthsBetween(m?.["join_date"] as string | null),
    contributionMonths: months.size,
    netSavings,
    netSalary,
    existingLoanExposure,
    guaranteeExposure,
    lifecycleStatus: (m?.["lifecycle_status"] as string | null) ?? null,
  };
}

export type EligibilityCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

export type EligibilityOutcome = {
  status: LoanEligibilityStatus;
  checks: EligibilityCheck[];
  savingsBasedLimit: number | null;
  incomeBasedLimit: number | null;
  policyBasedLimit: number | null;
  bindingLimit: number;
  proposedInstallment: number;
  debtServiceRatio: number | null;
  schedule: ScheduleResult;
  position: MemberFinancialPosition;
};

/** Evaluate a requested loan against the product rules and the member's live position. */
export function evaluateEligibility(args: {
  product: LoanProductRow;
  position: MemberFinancialPosition;
  requestedAmount: number;
  requestedTenure: number;
}): EligibilityOutcome {
  const { product, position, requestedAmount, requestedTenure } = args;
  const checks: EligibilityCheck[] = [];

  const scheduleInput = {
    annualRate: Number(product.interest_rate ?? 0),
    interestMethod: product.interest_method,
    tenure: requestedTenure,
    tenureUnit: product.tenure_unit,
    frequency: product.repayment_frequency,
    startDate: new Date(),
    fees: processingFee(
      product.processing_fee_type,
      Number(product.processing_fee_value ?? 0),
      requestedAmount,
    ),
    gracePeriods: product.grace_period ?? 0,
  };
  const schedule = buildSchedule({ ...scheduleInput, principal: requestedAmount });

  // membership tenure
  checks.push({
    name: "Membership length",
    passed: position.membershipMonths >= (product.minimum_membership_months ?? 0),
    detail: `${position.membershipMonths} month(s) as a member; ${product.minimum_membership_months} required.`,
  });

  // savings history
  checks.push({
    name: "Savings history",
    passed: position.contributionMonths >= (product.minimum_savings_months ?? 0),
    detail: `${position.contributionMonths} month(s) of contributions; ${product.minimum_savings_months} required.`,
  });

  // membership status
  checks.push({
    name: "Membership status",
    passed: position.lifecycleStatus === "ACTIVE",
    detail: `Member status is ${position.lifecycleStatus ?? "unknown"}.`,
  });

  // savings-based limit
  const savingsBasedLimit = product.savings_multiplier
    ? Number(product.savings_multiplier) * position.netSavings
    : null;
  if (savingsBasedLimit !== null) {
    checks.push({
      name: "Savings multiple",
      passed: requestedAmount <= savingsBasedLimit,
      detail: `${product.savings_multiplier}x net savings gives a ceiling of ${savingsBasedLimit.toFixed(2)}.`,
    });
  }

  // income-based limit
  let incomeBasedLimit: number | null = null;
  let debtServiceRatio: number | null = null;
  const installmentCap = product.maximum_installment_to_income_ratio;
  if (position.netSalary > 0) {
    const ratioCap = Number(installmentCap ?? product.maximum_debt_to_income_ratio ?? 33.33);
    const maxInstallment = (position.netSalary * ratioCap) / 100;
    incomeBasedLimit = affordablePrincipal(maxInstallment, scheduleInput);
    debtServiceRatio = (schedule.installmentAmount / position.netSalary) * 100;
    checks.push({
      name: "Affordability",
      passed: schedule.installmentAmount <= maxInstallment,
      detail: `Instalment ${schedule.installmentAmount.toFixed(2)} against a cap of ${maxInstallment.toFixed(2)} (${ratioCap}% of net salary).`,
    });
  } else {
    checks.push({
      name: "Affordability",
      passed: false,
      detail: "No net salary on record, so affordability cannot be confirmed.",
    });
  }

  // policy limit
  const policyBasedLimit = product.maximum_amount ? Number(product.maximum_amount) : null;
  checks.push({
    name: "Product amount range",
    passed:
      requestedAmount >= Number(product.minimum_amount ?? 0) &&
      (policyBasedLimit === null || requestedAmount <= policyBasedLimit),
    detail: policyBasedLimit
      ? `Allowed between ${Number(product.minimum_amount).toFixed(2)} and ${policyBasedLimit.toFixed(2)}.`
      : `Minimum ${Number(product.minimum_amount).toFixed(2)}; no maximum configured.`,
  });

  const months = tenureInMonths(requestedTenure, product.tenure_unit);
  const minMonths = tenureInMonths(product.minimum_tenure, product.tenure_unit);
  const maxMonths = tenureInMonths(product.maximum_tenure, product.tenure_unit);
  checks.push({
    name: "Tenure",
    passed: months >= minMonths && months <= maxMonths,
    detail: `Requested ${requestedTenure}; allowed ${product.minimum_tenure}–${product.maximum_tenure}.`,
  });

  const limits = [savingsBasedLimit, incomeBasedLimit, policyBasedLimit].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  const bindingLimit = limits.length > 0 ? Math.min(...limits) : requestedAmount;

  const hardFailures = checks.filter((c) => !c.passed);
  const status: LoanEligibilityStatus =
    hardFailures.length === 0
      ? "ELIGIBLE"
      : hardFailures.length <= 1 && requestedAmount > bindingLimit
        ? "CONDITIONAL"
        : hardFailures.some((c) =>
              ["Membership status", "Membership length", "Savings history"].includes(c.name),
            )
          ? "NOT_ELIGIBLE"
          : "CONDITIONAL";

  return {
    status,
    checks,
    savingsBasedLimit,
    incomeBasedLimit,
    policyBasedLimit,
    bindingLimit: Math.max(0, bindingLimit),
    proposedInstallment: schedule.installmentAmount,
    debtServiceRatio,
    schedule,
    position,
  };
}

/** Save a projected schedule against an application (replacing any earlier projection). */
export async function saveSchedule(args: {
  coopId: string;
  applicationId?: string | null;
  loanId?: string | null;
  schedule: ScheduleResult;
  startDate: string;
  status?: string;
  version?: number;
}): Promise<string> {
  const { coopId, applicationId, loanId, schedule, startDate } = args;

  if (applicationId) {
    await supabase
      .from("loan_schedules")
      .delete()
      .eq("loan_application_id", applicationId)
      .eq("status", "PROJECTED");
  }

  const { data: created, error } = await supabase
    .from("loan_schedules")
    .insert({
      cooperative_id: coopId,
      loan_application_id: applicationId ?? null,
      loan_id: loanId ?? null,
      schedule_version: args.version ?? 1,
      interest_method: schedule.interestMethod,
      interest_rate: schedule.annualRate,
      principal: schedule.principal,
      total_interest: schedule.totalInterest,
      total_fees: schedule.totalFees,
      total_repayment: schedule.totalRepayment,
      installment_amount: schedule.installmentAmount,
      number_of_periods: schedule.numberOfPeriods,
      start_date: startDate,
      status: args.status ?? "PROJECTED",
    })
    .select("id")
    .single();
  if (error) throw error;

  const lines = schedule.lines.map((l) => ({
    cooperative_id: coopId,
    schedule_id: created.id,
    ...l,
  }));
  const { error: lineErr } = await supabase.from("loan_schedule_lines").insert(lines);
  if (lineErr) throw lineErr;
  return created.id;
}

export async function recordStatusChange(args: {
  coopId: string;
  applicationId: string;
  from: string | null;
  to: string;
  reason?: string | null;
  userId?: string | null;
}) {
  await supabase.from("loan_application_status_history").insert({
    cooperative_id: args.coopId,
    loan_application_id: args.applicationId,
    from_status: args.from as never,
    to_status: args.to as never,
    reason: args.reason ?? null,
    changed_by: args.userId ?? null,
  });
}

export async function nextApplicationNumber(coopId: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_loan_application_number", {
    _cooperative_id: coopId,
  });
  if (error) throw error;
  return data as string;
}

export async function nextLoanNumber(coopId: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_loan_number", { _cooperative_id: coopId });
  if (error) throw error;
  return data as string;
}
