import type { Database } from "@/integrations/supabase/types";

type Enums = Database["public"]["Enums"];

export type LoanInterestMethod = Enums["loan_interest_method"];
export type LoanTenureUnit = Enums["loan_tenure_unit"];
export type LoanFeeType = Enums["loan_fee_type"];
export type LoanApplicationStatus = Enums["loan_application_status"];
export type LoanEligibilityStatus = Enums["loan_eligibility_status"];
export type LoanGuarantorStatus = Enums["loan_guarantor_status"];
export type LoanSecurityType = Enums["loan_security_type"];
export type LoanSecurityStatus = Enums["loan_security_status"];
export type LoanRiskRating = Enums["loan_risk_rating"];
export type LoanAccountStatus = Enums["loan_account_status"];
export type LoanTransactionType = Enums["loan_transaction_type"];
export type LoanTransactionStatus = Enums["loan_transaction_status"];
export type RepaymentFrequency = Enums["contribution_frequency"];

export const INTEREST_METHODS: LoanInterestMethod[] = [
  "FLAT",
  "REDUCING_BALANCE",
  "AMORTISED",
  "SIMPLE",
  "CUSTOM",
];

export const TENURE_UNITS: LoanTenureUnit[] = ["DAYS", "WEEKS", "MONTHS", "YEARS"];
export const FEE_TYPES: LoanFeeType[] = ["NONE", "FLAT", "PERCENTAGE"];
export const RISK_RATINGS: LoanRiskRating[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

export const SECURITY_TYPES: LoanSecurityType[] = [
  "SAVINGS",
  "SELF_GUARANTEE",
  "GUARANTOR",
  "PDC",
  "STANDING_INSTRUCTION",
  "INSURANCE",
  "ASSET",
  "PROPERTY",
  "INVESTMENT",
  "OTHER",
];

export const APPLICATION_PIPELINE: LoanApplicationStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "ELIGIBILITY_CHECK",
  "UNDER_REVIEW",
  "GUARANTOR_PENDING",
  "CREDIT_REVIEW",
  "CHECKED",
  "APPROVED",
  "DISBURSEMENT_PENDING",
  "DISBURSED",
];

export const CLOSED_APPLICATION_STATUSES: LoanApplicationStatus[] = [
  "REJECTED",
  "DECLINED",
  "WITHDRAWN",
  "CANCELLED",
  "CLOSED",
];

export function label(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function applicationStatusTone(
  status: LoanApplicationStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "APPROVED":
    case "DISBURSED":
    case "ACTIVE":
      return "default";
    case "REJECTED":
    case "DECLINED":
    case "CANCELLED":
    case "WITHDRAWN":
    case "DEFAULTED":
    case "WRITTEN_OFF":
      return "destructive";
    case "CLOSED":
      return "outline";
    default:
      return "secondary";
  }
}

export function eligibilityTone(
  status: LoanEligibilityStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ELIGIBLE") return "default";
  if (status === "NOT_ELIGIBLE") return "destructive";
  if (status === "CONDITIONAL") return "secondary";
  return "outline";
}

/** Statuses an application may legally move to next. */
export function nextApplicationStatuses(
  current: LoanApplicationStatus,
): LoanApplicationStatus[] {
  switch (current) {
    case "DRAFT":
      return ["SUBMITTED", "CANCELLED"];
    case "SUBMITTED":
      return ["ELIGIBILITY_CHECK", "WITHDRAWN", "CANCELLED"];
    case "ELIGIBILITY_CHECK":
      return ["UNDER_REVIEW", "GUARANTOR_PENDING", "REJECTED"];
    case "GUARANTOR_PENDING":
      return ["UNDER_REVIEW", "REJECTED", "CANCELLED"];
    case "UNDER_REVIEW":
      return ["CREDIT_REVIEW", "REJECTED"];
    case "CREDIT_REVIEW":
      return ["CHECKED", "REJECTED"];
    case "CHECKED":
      return ["APPROVED", "DECLINED", "UNDER_REVIEW"];
    case "APPROVED":
      return ["DISBURSEMENT_PENDING", "CANCELLED"];
    case "DISBURSEMENT_PENDING":
      return ["DISBURSED", "CANCELLED"];
    case "DISBURSED":
      return ["ACTIVE"];
    case "ACTIVE":
      return ["CLOSED", "DEFAULTED", "RESTRUCTURED", "WRITTEN_OFF"];
    default:
      return [];
  }
}

export function periodsPerYear(frequency: RepaymentFrequency): number {
  switch (frequency) {
    case "WEEKLY":
      return 52;
    case "BIWEEKLY":
      return 26;
    case "QUARTERLY":
      return 4;
    case "ANNUAL":
      return 1;
    default:
      return 12;
  }
}

export function tenureInMonths(tenure: number, unit: LoanTenureUnit): number {
  switch (unit) {
    case "DAYS":
      return tenure / 30;
    case "WEEKS":
      return (tenure * 7) / 30;
    case "YEARS":
      return tenure * 12;
    default:
      return tenure;
  }
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type ScheduleLine = {
  installment_number: number;
  due_date: string;
  opening_principal: number;
  principal: number;
  interest: number;
  fees: number;
  total_due: number;
  closing_principal: number;
};

export type ScheduleResult = {
  lines: ScheduleLine[];
  principal: number;
  totalInterest: number;
  totalFees: number;
  totalRepayment: number;
  installmentAmount: number;
  numberOfPeriods: number;
  interestMethod: LoanInterestMethod;
  annualRate: number;
};

export type ScheduleInput = {
  principal: number;
  annualRate: number;
  interestMethod: LoanInterestMethod;
  tenure: number;
  tenureUnit: LoanTenureUnit;
  frequency: RepaymentFrequency;
  startDate: Date;
  fees?: number;
  gracePeriods?: number;
};

function addPeriods(start: Date, frequency: RepaymentFrequency, count: number): Date {
  const d = new Date(start.getTime());
  switch (frequency) {
    case "WEEKLY":
      d.setDate(d.getDate() + 7 * count);
      break;
    case "BIWEEKLY":
      d.setDate(d.getDate() + 14 * count);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3 * count);
      break;
    case "ANNUAL":
      d.setFullYear(d.getFullYear() + count);
      break;
    default:
      d.setMonth(d.getMonth() + count);
  }
  return d;
}

/** Build a repayment schedule. Pure maths — the same figures serve staff and members. */
export function buildSchedule(input: ScheduleInput): ScheduleResult {
  const ppy = periodsPerYear(input.frequency);
  const months = tenureInMonths(input.tenure, input.tenureUnit);
  const periods = Math.max(1, Math.round((months * ppy) / 12));
  const principal = round2(input.principal);
  const fees = round2(input.fees ?? 0);
  const annualRate = input.annualRate;
  const periodicRate = annualRate / 100 / ppy;

  const principals: number[] = [];
  const interests: number[] = [];

  if (input.interestMethod === "REDUCING_BALANCE") {
    const basePrincipal = principal / periods;
    let outstanding = principal;
    for (let i = 0; i < periods; i += 1) {
      const interest = outstanding * periodicRate;
      principals.push(basePrincipal);
      interests.push(interest);
      outstanding -= basePrincipal;
    }
  } else if (input.interestMethod === "AMORTISED") {
    const r = periodicRate;
    const installment =
      r === 0 ? principal / periods : (principal * r) / (1 - Math.pow(1 + r, -periods));
    let outstanding = principal;
    for (let i = 0; i < periods; i += 1) {
      const interest = outstanding * r;
      const principalPart = Math.min(installment - interest, outstanding);
      principals.push(principalPart);
      interests.push(interest);
      outstanding -= principalPart;
    }
  } else {
    // FLAT, SIMPLE and CUSTOM: interest is charged on the original principal
    const totalInterest = principal * (annualRate / 100) * (months / 12);
    for (let i = 0; i < periods; i += 1) {
      principals.push(principal / periods);
      interests.push(totalInterest / periods);
    }
  }

  const feePerPeriod = fees / periods;
  const lines: ScheduleLine[] = [];
  let opening = principal;
  let principalAllocated = 0;

  for (let i = 0; i < periods; i += 1) {
    const isLast = i === periods - 1;
    const principalPart = isLast
      ? round2(principal - principalAllocated)
      : round2(principals[i] ?? 0);
    principalAllocated = round2(principalAllocated + principalPart);
    const interestPart = round2(interests[i] ?? 0);
    const feePart = round2(isLast ? fees - round2(feePerPeriod) * (periods - 1) : feePerPeriod);
    const closing = round2(opening - principalPart);
    lines.push({
      installment_number: i + 1,
      due_date: addPeriods(input.startDate, input.frequency, i + 1 + (input.gracePeriods ?? 0))
        .toISOString()
        .slice(0, 10),
      opening_principal: round2(opening),
      principal: principalPart,
      interest: interestPart,
      fees: feePart,
      total_due: round2(principalPart + interestPart + feePart),
      closing_principal: closing < 0 ? 0 : closing,
    });
    opening = closing;
  }

  const totalInterest = round2(lines.reduce((s, l) => s + l.interest, 0));
  const totalFees = round2(lines.reduce((s, l) => s + l.fees, 0));
  const totalRepayment = round2(principal + totalInterest + totalFees);

  return {
    lines,
    principal,
    totalInterest,
    totalFees,
    totalRepayment,
    installmentAmount: round2(lines[0]?.total_due ?? 0),
    numberOfPeriods: periods,
    interestMethod: input.interestMethod,
    annualRate,
  };
}

export function processingFee(
  feeType: LoanFeeType,
  feeValue: number,
  principal: number,
): number {
  if (feeType === "FLAT") return round2(feeValue);
  if (feeType === "PERCENTAGE") return round2((principal * feeValue) / 100);
  return 0;
}

/** Largest principal whose installment stays inside the affordability cap. */
export function affordablePrincipal(
  maxInstallment: number,
  input: Omit<ScheduleInput, "principal">,
): number {
  if (maxInstallment <= 0) return 0;
  const probe = buildSchedule({ ...input, principal: 100000 });
  if (probe.installmentAmount <= 0) return 0;
  const ratio = maxInstallment / probe.installmentAmount;
  return round2(100000 * ratio);
}

export function friendlyLoanError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/posted loan transactions cannot be edited/i.test(message))
    return "This entry has already been posted. Record a reversal instead of changing it.";
  if (/cannot be deleted/i.test(message))
    return "Loan entries are permanent. Record a reversal instead of deleting.";
  if (/duplicate key/i.test(message) && /product_code/i.test(message))
    return "That product code is already in use in this cooperative.";
  if (/duplicate key/i.test(message) && /guarantor/i.test(message))
    return "That person has already been added as a guarantor on this application.";
  if (/duplicate key/i.test(message)) return "A record with those details already exists.";
  if (/row-level security|permission/i.test(message))
    return "You do not have permission to make this change.";
  return message || "Something went wrong. Please try again.";
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
