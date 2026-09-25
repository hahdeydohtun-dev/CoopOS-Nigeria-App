import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/format";
import { friendlySavingsError } from "@/lib/savings";
import { ensureSavingsAccount, nextTransactionNumber } from "@/lib/savings-accounts";

const today = () => new Date().toISOString().slice(0, 10);

type Line = { productId: string; amount: string };

export function SplitReceipt({
  coopId,
  products,
  periods,
}: {
  coopId: string;
  products: { id: string; product_name: string }[];
  periods: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [memberSearch, setMemberSearch] = useState("");
  const [memberId, setMemberId] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [valueDate, setValueDate] = useState(today());
  const [periodId, setPeriodId] = useState("NONE");
  const [lines, setLines] = useState<Line[]>([{ productId: "", amount: "" }]);

  const members = useQuery({
    queryKey: ["split-member-options", coopId, memberSearch],
    queryFn: async () => {
      let q = supabase
        .from("members")
        .select("id, first_name, last_name, member_number, membership_number")
        .eq("cooperative_id", coopId)
        .order("last_name")
        .limit(25);
      if (memberSearch.trim()) {
        const t = `%${memberSearch.trim()}%`;
        q = q.or(
          `first_name.ilike.${t},last_name.ilike.${t},member_number.ilike.${t},membership_number.ilike.${t}`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const allocated = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const receipt = Number(receiptAmount) || 0;
  const remaining = receipt - allocated;
  const balanced = receipt > 0 && Math.abs(remaining) < 0.005;
  const usable = lines.filter((l) => l.productId && Number(l.amount) > 0);
  const duplicateProduct = new Set(usable.map((l) => l.productId)).size !== usable.length;

  const save = useMutation({
    mutationFn: async () => {
      for (const line of usable) {
        const amount = Number(line.amount);
        const accountId = await ensureSavingsAccount(coopId, memberId, line.productId);
        const txNumber = await nextTransactionNumber(coopId);
        const { data: tx, error } = await supabase
          .from("savings_transactions")
          .insert({
            cooperative_id: coopId,
            member_id: memberId,
            savings_account_id: accountId,
            savings_product_id: line.productId,
            period_id: periodId === "NONE" ? null : periodId,
            transaction_number: txNumber,
            transaction_type: "CONTRIBUTION",
            direction: "CREDIT",
            amount,
            transaction_date: valueDate,
            value_date: valueDate,
            source: "BANK_TRANSFER",
            payment_reference: receiptRef.trim() || null,
            description: `Part of receipt ${receiptRef.trim() || "(no reference)"}`,
            status: "SUBMITTED",
          })
          .select("id")
          .single();
        if (error) throw error;

        const { error: allocErr } = await supabase.from("contribution_allocations").insert({
          cooperative_id: coopId,
          member_id: memberId,
          receipt_reference: receiptRef.trim() || null,
          receipt_amount: receipt,
          savings_product_id: line.productId,
          savings_transaction_id: tx.id,
          period_id: periodId === "NONE" ? null : periodId,
          amount,
          status: "PENDING",
        });
        if (allocErr) throw allocErr;
      }
    },
    onSuccess: () => {
      toast.success("Receipt split and sent for checking.");
      setReceiptRef("");
      setReceiptAmount("");
      setLines([{ productId: "", amount: "" }]);
      void qc.invalidateQueries({ queryKey: ["recent-contributions", coopId] });
    },
    onError: (e) => toast.error(friendlySavingsError(e)),
  });

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Split one payment across savings products</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Find member</Label>
            <Input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Name or member number"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Member</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {(members.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.first_name} {m.last_name} — {m.member_number ?? m.membership_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Receipt reference</Label>
            <Input value={receiptRef} onChange={(e) => setReceiptRef(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Total received (₦)</Label>
            <Input
              inputMode="decimal"
              value={receiptAmount}
              onChange={(e) => setReceiptAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Value date</Label>
            <Input type="date" value={valueDate} onChange={(e) => setValueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contribution period</Label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Not linked to a period</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">How the payment is shared</Label>
          {lines.map((line, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Select value={line.productId} onValueChange={(v) => setLine(i, { productId: v })}>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Savings product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.product_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="w-40"
                inputMode="decimal"
                placeholder="Amount"
                value={line.amount}
                onChange={(e) => setLine(i, { amount: e.target.value })}
              />
              {lines.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLines((prev) => [...prev, { productId: "", amount: "" }])}
          >
            Add another product
          </Button>
        </div>

        <p className="text-sm">
          Shared out {formatNaira(allocated)} of {formatNaira(receipt)} —{" "}
          {balanced ? (
            <span className="text-muted-foreground">fully allocated</span>
          ) : (
            <span className="text-destructive">
              {remaining > 0 ? `${formatNaira(remaining)} still to share` : `${formatNaira(Math.abs(remaining))} over the receipt`}
            </span>
          )}
        </p>
        {duplicateProduct && (
          <p className="text-sm text-destructive">
            The same product is listed twice. Combine those amounts into one line.
          </p>
        )}

        <Button
          onClick={() => save.mutate()}
          disabled={
            save.isPending || !memberId || !balanced || usable.length === 0 || duplicateProduct
          }
        >
          {save.isPending ? "Saving…" : "Record split receipt"}
        </Button>
      </CardContent>
    </Card>
  );
}
