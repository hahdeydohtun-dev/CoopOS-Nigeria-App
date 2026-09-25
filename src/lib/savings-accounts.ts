import { supabase } from "@/integrations/supabase/client";

/** Find the member's account for a product, opening one if it does not exist yet. */
export async function ensureSavingsAccount(
  coopId: string,
  memberId: string,
  productId: string,
): Promise<string> {
  const { data: existing, error: findErr } = await supabase
    .from("member_savings_accounts")
    .select("id")
    .eq("cooperative_id", coopId)
    .eq("member_id", memberId)
    .eq("savings_product_id", productId)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing?.id) return existing.id;

  const { data: number, error: numErr } = await supabase.rpc("next_savings_account_number", {
    _cooperative_id: coopId,
    _member_id: memberId,
    _product_id: productId,
  });
  if (numErr) throw numErr;

  const { data: created, error: createErr } = await supabase
    .from("member_savings_accounts")
    .insert({
      cooperative_id: coopId,
      member_id: memberId,
      savings_product_id: productId,
      account_number: number as string,
    })
    .select("id")
    .single();
  if (createErr) throw createErr;
  return created.id;
}

export async function nextTransactionNumber(coopId: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_savings_transaction_number", {
    _cooperative_id: coopId,
  });
  if (error) throw error;
  return data as string;
}
