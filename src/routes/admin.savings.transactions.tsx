import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDate, formatNaira } from "@/lib/format";
import {
  TRANSACTION_STATUSES,
  friendlySavingsError,
  label,
  nextStatuses,
  transactionStatusTone,
  type SavingsTransactionStatus,
} from "@/lib/savings";

export const Route = createFileRoute("/admin/savings/transactions")({
  head: () => ({
    meta: [
      { title: "Savings transactions — CoopOS Nigeria" },
      { name: "description", content: "The savings ledger: check, approve, post and reverse entries." },
      { property: "og:title", content: "Savings transactions — CoopOS Nigeria" },
      { property: "og:description", content: "The savings ledger: check, approve, post and reverse entries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SavingsTransactionsPage,
});

type Row = {
  id: string;
  transaction_number: string;
  transaction_type: string;
  direction: string;
  amount: number;
  transaction_date: string;
  value_date: string;
  source: string;
  status: SavingsTransactionStatus;
  payment_reference: string | null;
  member_id: string;
  savings_account_id: string;
  savings_product_id: string;
  cooperative_id: string;
  members: { first_name: string; last_name: string; member_number: string | null } | null;
  savings_products: { product_name: string } | null;
};

function SavingsTransactionsPage() {
  const { cooperative, hasPermission, user } = useSession();
  const coopId = cooperative?.id ?? null;
  const qc = useQueryClient();
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [reversing, setReversing] = useState<Row | null>(null);
  const [reason, setReason] = useState("");

  const can = {
    check: hasPermission("savings.check"),
    approve: hasPermission("savings.approve"),
    post: hasPermission("savings.post"),
    reverse: hasPermission("savings.reverse"),
    create: hasPermission("savings.create"),
  };

  const transactions = useQuery({
    queryKey: ["savings-transactions", coopId, status, search],
    enabled: Boolean(coopId),
    queryFn: async () => {
      let q = supabase
        .from("savings_transactions")
        .select(
          "id, transaction_number, transaction_type, direction, amount, transaction_date, value_date, source, status, payment_reference, member_id, savings_account_id, savings_product_id, cooperative_id, members(first_name, last_name, member_number), savings_products(product_name)",
        )
        .eq("cooperative_id", coopId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "ALL") q = q.eq("status", status as SavingsTransactionStatus);
      if (search.trim()) q = q.ilike("transaction_number", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const move = useMutation({
    mutationFn: async ({ row, to }: { row: Row; to: SavingsTransactionStatus }) => {
      const patch = {
        status: to,
        ...(to === "CHECKED" ? { checked_by: user?.id ?? null } : {}),
        ...(to === "APPROVED" ? { approved_by: user?.id ?? null } : {}),
        ...(to === "POSTED" ? { posted_by: user?.id ?? null } : {}),
      };
      const { error } = await supabase.from("savings_transactions").update(patch).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entry updated.");
      void qc.invalidateQueries({ queryKey: ["savings-transactions", coopId] });
    },
    onError: (e) => toast.error(friendlySavingsError(e)),
  });

  const reverse = useMutation({
    mutationFn: async () => {
      const row = reversing!;
      const { data: txNumber, error: tnErr } = await supabase.rpc(
        "next_savings_transaction_number",
        { _cooperative_id: coopId! },
      );
      if (tnErr) throw tnErr;
      const { error: insErr } = await supabase.from("savings_transactions").insert({
        cooperative_id: row.cooperative_id,
        member_id: row.member_id,
        savings_account_id: row.savings_account_id,
        savings_product_id: row.savings_product_id,
        transaction_number: txNumber as string,
        transaction_type: "REVERSAL",
        direction: row.direction === "CREDIT" ? "DEBIT" : "CREDIT",
        amount: row.amount,
        transaction_date: new Date().toISOString().slice(0, 10),
        value_date: new Date().toISOString().slice(0, 10),
        source: "SYSTEM",
        description: `Reversal of ${row.transaction_number}`,
        reversal_of_transaction_id: row.id,
        reversal_reason: reason,
        status: "POSTED",
        posted_by: user?.id ?? null,
      });
      if (insErr) throw insErr;
      const { error: updErr } = await supabase
        .from("savings_transactions")
        .update({ status: "REVERSED", reversal_reason: reason, reversed_at: new Date().toISOString() })
        .eq("id", row.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success("Reversal posted. The original entry is kept for the record.");
      setReversing(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["savings-transactions", coopId] });
    },
    onError: (e) => toast.error(friendlySavingsError(e)),
  });

  const allowed = (row: Row, to: SavingsTransactionStatus) => {
    if (!nextStatuses(row.status).includes(to)) return false;
    if (to === "CHECKED") return can.check;
    if (to === "APPROVED") return can.approve;
    if (to === "POSTED") return can.post;
    if (to === "REVERSED") return can.reverse;
    if (to === "SUBMITTED") return can.create;
    if (to === "REJECTED") return can.check || can.approve;
    return false;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings transactions"
        description="Posted entries are permanent. A mistake is corrected by posting a reversal, never by editing."
      />

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search entry number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {TRANSACTION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {label(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {transactions.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading ledger…</p>
          ) : (transactions.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No savings entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entry</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(transactions.data ?? []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.transaction_number}</TableCell>
                      <TableCell>{formatDate(t.transaction_date)}</TableCell>
                      <TableCell>
                        {t.members?.first_name} {t.members?.last_name}
                      </TableCell>
                      <TableCell>{t.savings_products?.product_name}</TableCell>
                      <TableCell>
                        {label(t.transaction_type)}
                        <span className="block text-xs text-muted-foreground">
                          {label(t.direction)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatNaira(t.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={transactionStatusTone(t.status)}>{label(t.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {(["SUBMITTED", "CHECKED", "APPROVED", "POSTED", "REJECTED"] as SavingsTransactionStatus[])
                            .filter((to) => allowed(t, to))
                            .map((to) => (
                              <Button
                                key={to}
                                size="sm"
                                variant={to === "POSTED" ? "default" : "outline"}
                                onClick={() => move.mutate({ row: t, to })}
                                disabled={move.isPending}
                              >
                                {to === "REJECTED" ? "Reject" : label(to)}
                              </Button>
                            ))}
                          {allowed(t, "REVERSED") && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setReversing(t)}
                            >
                              Reverse
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(reversing)} onOpenChange={(o) => !o && setReversing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse {reversing?.transaction_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Reason for the reversal</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              The original entry stays on the record. A matching opposite entry is posted.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => reverse.mutate()}
              disabled={reverse.isPending || reason.trim().length < 3}
            >
              {reverse.isPending ? "Posting…" : "Post reversal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
