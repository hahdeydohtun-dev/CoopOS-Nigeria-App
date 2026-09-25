import { supabase } from "@/integrations/supabase/client";
import { buildSchedule, type LoanInterestMethod, type LoanTenureUnit, type RepaymentFrequency } from "@/lib/loans";
import { saveSchedule } from "@/lib/loans-engine";
import { notifyMembers, notifyStaff } from "@/lib/notify";
import { nextTransactionNumber } from "@/lib/savings-accounts";
import { postRepayment } from "@/lib/repayments";

/* ------------------------------------------------------------------ */
/* Payroll deductions marked as loan repayments                        */
/* ------------------------------------------------------------------ */

export type PayrollRoutingResult = {
  posted: number;
  held: number;
  totalPosted: number;
  messages: string[];
};

/**
 * Bring payroll check-off lines that are loan repayments into the loan ledger.
 * A line only posts when it is matched to a member with exactly one live loan;
 * anything else is held for someone to look at, never guessed at.
 */
export async function importPayrollLoanDeductions(args: {
  coopId: string;
  userId?: string | null;
  batchId?: string | null;
}): Promise<PayrollRoutingResult> {
  let query = supabase
    .from("checkoff_batch_lines")
    .select(
      "id, batch_id, deduction_amount, payroll_date, source_reference, matched_member_id, employee_name, posting_status, checkoff_batches!inner(status)",
    )
    .eq("cooperative_id", args.coopId)
    .eq("deduction_type", "LOAN_REPAYMENT")
    .in("posting_status", ["PENDING", "HELD"])
    .in("checkoff_batches.status", ["APPROVED", "POSTED", "PARTIALLY_POSTED"]);
  if (args.batchId) query = query.eq("batch_id", args.batchId);

  const { data: lines, error } = await query;
  if (error) throw error;

  const result: PayrollRoutingResult = { posted: 0, held: 0, totalPosted: 0, messages: [] };
  if (!lines || lines.length === 0) return result;

  for (const line of lines) {
    const amount = Number(line.deduction_amount ?? 0);
    const memberId = line.matched_member_id;
    const hold = async (reason: string) => {
      result.held += 1;
      result.messages.push(`${line.employee_name ?? "A payroll line"}: ${reason}`);
      await supabase
        .from("checkoff_batch_lines")
        .update({ posting_status: "HELD" as const, exception_status: reason })
        .eq("id", line.id);
    };

    if (!memberId) {
      await hold("not matched to a member");
      continue;
    }
    if (!(amount > 0)) {
      await hold("the deduction amount is not usable");
      continue;
    }

    const { data: loans } = await supabase
      .from("loans")
      .select("id, loan_number, member_id")
      .eq("cooperative_id", args.coopId)
      .eq("member_id", memberId)
      .in("status", ["ACTIVE", "RESTRUCTURED", "DEFAULTED"])
      .order("start_date");

    if (!loans || loans.length === 0) {
      await hold("this member has no loan to repay");
      continue;
    }
    if (loans.length > 1) {
      await hold("this member has more than one loan, so the payment needs a decision");
      continue;
    }

    try {
      await postRepayment({
        coopId: args.coopId,
        loanId: loans[0]!.id,
        memberId,
        amount,
        repaymentDate: line.payroll_date ?? new Date().toISOString().slice(0, 10),
        source: "CHECK_OFF",
        checkoffBatchId: line.batch_id,
        checkoffLineId: line.id,
        externalReference: line.source_reference ?? null,
        notes: "Payroll deduction",
        userId: args.userId ?? null,
      });
      await supabase
        .from("checkoff_batch_lines")
        .update({ posting_status: "POSTED" as const, exception_status: "NONE" })
        .eq("id", line.id);
      result.posted += 1;
      result.totalPosted += amount;
    } catch (e) {
      await hold(e instanceof Error ? e.message : "could not be posted");
    }
  }

  await notifyStaff({
    cooperativeId: args.coopId,
    eventType: "CHECKOFF_LOAN_ROUTED",
    title: `${result.posted} payroll deduction(s) applied to loans`,
    ...(result.held > 0 ? { body: `${result.held} line(s) are being held for review.` } : {}),
    link: "/admin/repayments/payments",
    severity: result.held > 0 ? "ACTION" : "INFO",
  });

  return result;
}

/* ------------------------------------------------------------------ */
/* Recovery from savings / from a guarantor                            */
/* ------------------------------------------------------------------ */

/**
 * Take an approved amount out of a member's savings and apply it to the loan.
 * Nothing happens automatically — this is always a decided, recorded action.
 */
export async function recoverFromSavings(args: {
  coopId: string;
  loanId: string;
  memberId: string;
  savingsAccountId: string;
  amount: number;
  date: string;
  reason: string;
  userId?: string | null;
}) {
  if (!(args.amount > 0)) throw new Error("Enter an amount greater than zero.");

  const { data: account, error: accountError } = await supabase
    .from("member_savings_accounts")
    .select("id, savings_product_id, member_id, available_balance, status")
    .eq("id", args.savingsAccountId)
    .single();
  if (accountError) throw accountError;
  if (account.status !== "ACTIVE") throw new Error("That savings account is not active.");

  const available = Number(account.available_balance ?? 0);
  if (args.amount > available + 0.01)
    throw new Error("There is not enough available savings to cover that amount.");

  const txNumber = await nextTransactionNumber(args.coopId);
  const { data: tx, error: txError } = await supabase
    .from("savings_transactions")
    .insert({
      cooperative_id: args.coopId,
      member_id: args.memberId,
      savings_account_id: account.id,
      savings_product_id: account.savings_product_id,
      transaction_number: txNumber,
      transaction_type: "WITHDRAWAL",
      direction: "DEBIT",
      amount: args.amount,
      transaction_date: args.date,
      value_date: args.date,
      source: "SYSTEM",
      description: `Applied to loan: ${args.reason}`,
      status: "POSTED",
      created_by: args.userId ?? null,
    })
    .select("id")
    .single();
  if (txError) throw txError;

  try {
    return await postRepayment({
      coopId: args.coopId,
      loanId: args.loanId,
      memberId: args.memberId,
      amount: args.amount,
      repaymentDate: args.date,
      source: "SAVINGS_OFFSET",
      externalReference: txNumber,
      notes: args.reason,
      userId: args.userId ?? null,
    });
  } catch (e) {
    await supabase
      .from("savings_transactions")
      .update({ status: "CANCELLED", description: "Loan offset could not be completed" })
      .eq("id", tx.id);
    throw e;
  }
}

/** Money recovered from a guarantor and applied to the loan. */
export async function recoverFromGuarantor(args: {
  coopId: string;
  loanId: string;
  memberId: string | null;
  amount: number;
  date: string;
  reference: string;
  notes: string;
  userId?: string | null;
}) {
  return postRepayment({
    coopId: args.coopId,
    loanId: args.loanId,
    memberId: args.memberId,
    amount: args.amount,
    repaymentDate: args.date,
    source: "GUARANTOR_RECOVERY",
    externalReference: args.reference || null,
    notes: args.notes || "Recovered from guarantor",
    userId: args.userId ?? null,
  });
}

/* ------------------------------------------------------------------ */
/* Restructuring: a new repayment plan, the old one preserved          */
/* ------------------------------------------------------------------ */

export type RestructureTerms = {
  tenure?: number | null;
  frequency?: RepaymentFrequency | null;
  interestRate?: number | null;
  capitaliseArrears?: boolean;
  effectiveDate: string;
};

/**
 * Put an approved restructure into effect: the old plan is kept as history and a
 * new, current repayment plan takes over from the effective date.
 */
export async function applyRestructure(args: {
  coopId: string;
  restructureId: string;
  userId?: string | null;
}) {
  const { data: request, error } = await supabase
    .from("loan_restructures")
    .select("*")
    .eq("id", args.restructureId)
    .single();
  if (error) throw error;
  if (request.new_schedule_id) return request.new_schedule_id as string;

  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select(
      "id, loan_number, member_id, interest_method, interest_rate, tenure, tenure_unit, repayment_frequency, outstanding_principal, outstanding_interest, outstanding_fees, outstanding_penalties, schedule_version",
    )
    .eq("id", request.loan_id!)
    .single();
  if (loanError) throw loanError;

  const effectiveDate = (request.effective_date as string | null) ?? new Date().toISOString().slice(0, 10);
  const capitalise = Boolean(request.capitalise_arrears);
  const principal =
    Number(loan.outstanding_principal ?? 0) +
    (capitalise
      ? Number(loan.outstanding_interest ?? 0) +
        Number(loan.outstanding_fees ?? 0) +
        Number(loan.outstanding_penalties ?? 0)
      : 0);
  if (!(principal > 0)) throw new Error("This loan has nothing left to reschedule.");

  const tenure = Number(request.new_tenure ?? loan.tenure ?? 12);
  const frequency = (request.new_frequency ?? loan.repayment_frequency ?? "MONTHLY") as RepaymentFrequency;
  const rate = Number(request.new_interest_rate ?? loan.interest_rate ?? 0);

  const schedule = buildSchedule({
    principal,
    annualRate: rate,
    interestMethod: loan.interest_method as LoanInterestMethod,
    tenure,
    tenureUnit: (loan.tenure_unit ?? "MONTHS") as LoanTenureUnit,
    frequency,
    startDate: new Date(`${effectiveDate}T00:00:00Z`),
  });

  const version = Number(loan.schedule_version ?? 1) + 1;

  // The old plan stays on record; it is simply no longer the current one.
  await supabase
    .from("loan_schedules")
    .update({ status: "SUPERSEDED" })
    .eq("loan_id", loan.id)
    .eq("status", "ACTIVE");

  const newScheduleId = await saveSchedule({
    coopId: args.coopId,
    loanId: loan.id,
    schedule,
    startDate: effectiveDate,
    status: "ACTIVE",
    version,
  });

  await supabase
    .from("loans")
    .update({
      status: "RESTRUCTURED",
      schedule_version: version,
      interest_rate: rate,
      tenure,
      repayment_frequency: frequency,
      installment_amount: schedule.installmentAmount,
      updated_by: args.userId ?? null,
    })
    .eq("id", loan.id);

  await supabase
    .from("loan_restructures")
    .update({
      new_schedule_id: newScheduleId,
      status: "EFFECTIVE",
      effective_date: effectiveDate,
      new_terms: {
        principal,
        interest_rate: rate,
        tenure,
        frequency,
        installment_amount: schedule.installmentAmount,
        arrears_capitalised: capitalise,
      },
    })
    .eq("id", request.id);

  if (loan.member_id) {
    await notifyMembers(args.coopId, [loan.member_id], {
      eventType: "RESTRUCTURING_APPROVAL",
      title: "Your loan has a new repayment plan",
      body: `Loan ${loan.loan_number} now runs from ${effectiveDate}. You can see the new schedule in your portal.`,
    });
  }

  return newScheduleId;
}
