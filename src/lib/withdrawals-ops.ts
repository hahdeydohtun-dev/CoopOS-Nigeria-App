import { supabase } from "@/integrations/supabase/client";
import { notifyMembers, notifyStaff } from "@/lib/notify";
import { nextTransactionNumber } from "@/lib/savings-accounts";
import { assertPeriodOpen } from "@/lib/withdrawals";

/**
 * Pays out an approved exit settlement and closes the membership.
 * Every savings account is emptied through real posted savings transactions,
 * so the member's history stays complete and nothing is edited in place.
 */
export async function settleExit(input: {
  coopId: string;
  settlementId: string;
  paymentDate: string;
  paymentReference: string | null;
  userId: string | null;
}) {
  const { data: settlement, error } = await supabase
    .from("exit_settlements")
    .select("id, member_id, settlement_number, status, exit_type, net_settlement, exit_reason")
    .eq("id", input.settlementId)
    .single();
  if (error) throw error;
  if (settlement.status !== "APPROVED") {
    throw new Error("Only an approved settlement can be paid out.");
  }
  await assertPeriodOpen(input.coopId, input.paymentDate);

  const { data: accounts } = await supabase
    .from("member_savings_accounts")
    .select("id, savings_product_id, available_balance, status")
    .eq("cooperative_id", input.coopId)
    .eq("member_id", settlement.member_id)
    .eq("status", "ACTIVE");

  let paid = 0;
  for (const account of accounts ?? []) {
    const amount = Number(account.available_balance ?? 0);
    if (amount <= 0) continue;
    const txNumber = await nextTransactionNumber(input.coopId);
    const { error: txErr } = await supabase.from("savings_transactions").insert({
      cooperative_id: input.coopId,
      member_id: settlement.member_id,
      savings_account_id: account.id,
      savings_product_id: account.savings_product_id,
      transaction_number: txNumber,
      transaction_type: "WITHDRAWAL",
      direction: "DEBIT",
      amount,
      transaction_date: input.paymentDate,
      value_date: input.paymentDate,
      source: "BANK_TRANSFER",
      payment_reference: input.paymentReference,
      description: `Exit settlement ${settlement.settlement_number}`,
      status: "POSTED",
      posted_by: input.userId,
      posted_at: new Date().toISOString(),
    });
    if (txErr) throw txErr;
    paid += amount;
  }

  await supabase
    .from("exit_settlements")
    .update({
      status: "SETTLED",
      settled_at: new Date().toISOString(),
      effective_date: input.paymentDate,
    })
    .eq("id", settlement.id);

  const exitStatus =
    settlement.exit_type === "RETIREMENT"
      ? "RETIRED"
      : settlement.exit_type === "DECEASED"
        ? "DECEASED"
        : "EXITED";

  const { error: statusErr } = await supabase.rpc("change_member_status", {
    _member_id: settlement.member_id,
    _new_status: exitStatus as never,
    _reason: `Exit settlement ${settlement.settlement_number} paid`,
    _effective_date: input.paymentDate,
  });
  if (statusErr) throw statusErr;

  await notifyMembers(input.coopId, [settlement.member_id], {
    eventType: "EXIT_SETTLEMENT_PAID",
    title: `Exit settlement ${settlement.settlement_number} paid`,
    body: "Your membership has been closed and your settlement paid.",
  });
  await notifyStaff({
    cooperativeId: input.coopId,
    eventType: "EXIT_SETTLEMENT_PAID",
    title: `Exit settlement ${settlement.settlement_number} paid`,
    link: "/admin/withdrawals/exit-settlements",
  });

  return paid;
}

/** A member asks for a new or changed payout account. It stays unusable until verified and approved. */
export async function requestBankAccountChange(input: {
  coopId: string;
  memberId: string;
  bankName: string;
  bankCode: string | null;
  accountNumber: string;
  accountName: string;
  reason: string | null;
  userId: string | null;
}) {
  if (!input.bankName.trim() || !input.accountNumber.trim() || !input.accountName.trim()) {
    throw new Error("Bank, account number and account name are all needed.");
  }
  const { error } = await supabase.from("member_bank_accounts").insert({
    cooperative_id: input.coopId,
    member_id: input.memberId,
    bank_name: input.bankName.trim(),
    bank_code: input.bankCode?.trim() || null,
    account_number: input.accountNumber.trim(),
    account_name: input.accountName.trim(),
    change_status: "PENDING",
    change_reason: input.reason?.trim() || null,
    is_verified: false,
    active: false,
    created_by: input.userId,
  });
  if (error) throw error;

  await notifyStaff({
    cooperativeId: input.coopId,
    eventType: "BANK_ACCOUNT_CHANGE_REQUESTED",
    title: "A member asked to change their payout account",
    body: `${input.bankName} · ${input.accountNumber}`,
    link: "/admin/withdrawals/exceptions",
    severity: "ACTION",
  });
}

/** Staff verify, then approve or reject a payout account change. */
export async function decideBankAccountChange(input: {
  coopId: string;
  accountId: string;
  action: "VERIFY" | "APPROVE" | "REJECT";
  reason: string | null;
  userId: string | null;
}) {
  const { data: account, error } = await supabase
    .from("member_bank_accounts")
    .select("id, member_id, is_verified, verified_by, change_status, bank_name, account_number")
    .eq("id", input.accountId)
    .single();
  if (error) throw error;

  if (input.action === "VERIFY") {
    const { error: e } = await supabase
      .from("member_bank_accounts")
      .update({ is_verified: true, verified_by: input.userId, verified_at: new Date().toISOString() })
      .eq("id", account.id);
    if (e) throw e;
    return;
  }

  if (input.action === "APPROVE") {
    if (!account.is_verified) throw new Error("Verify the account details before approving it.");
    if (account.verified_by && account.verified_by === input.userId) {
      throw new Error("The person who verified an account cannot also approve it.");
    }
    const { error: e } = await supabase
      .from("member_bank_accounts")
      .update({
        change_status: "APPROVED",
        active: true,
        approved_by: input.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", account.id);
    if (e) throw e;
    await notifyMembers(input.coopId, [account.member_id], {
      eventType: "BANK_ACCOUNT_APPROVED",
      title: "Your payout account is now active",
      body: `${account.bank_name} · ${account.account_number}`,
    });
    return;
  }

  const { error: e } = await supabase
    .from("member_bank_accounts")
    .update({ change_status: "REJECTED", active: false, change_reason: input.reason })
    .eq("id", account.id);
  if (e) throw e;
  await notifyMembers(input.coopId, [account.member_id], {
    eventType: "BANK_ACCOUNT_REJECTED",
    title: "Your payout account was not accepted",
    body: input.reason ?? "Please check the details and send them again.",
  });
}
