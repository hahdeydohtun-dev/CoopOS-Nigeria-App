import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import { friendlySavingsError, label } from "@/lib/savings";
import { nextTransactionNumber } from "@/lib/savings-accounts";

export const Route = createFileRoute("/admin/savings/bonus")({
  head: () => ({
    meta: [
      { title: "Savings bonus — CoopOS Nigeria" },
      {
        name: "description",
        content: "Calculate, review, approve and post the savings bonus to members.",
      },
      { property: "og:title", content: "Savings bonus — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Calculate, review, approve and post the savings bonus to members.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BonusPage,
});

const round2 = (n: number) => Math.round(n * 100) / 100;

function BonusPage() {
  const { cooperative, hasPermission, user } = useSession();
  const coopId = cooperative?.id ?? null;
  const qc = useQueryClient();

  const canCreate = hasPermission("savings.create");
  const canApprove = hasPermission("savings.approve");
  const canPost = hasPermission("savings.post");

  const [name, setName] = useState("");
  const [productId, setProductId] = useState("ALL");
  const [start, setStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [basis, setBasis] = useState("CLOSING_BALANCE");
  const [rate, setRate] = useState("");
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ["bonus-products", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_products")
        .select("id, product_name, bonus_eligible")
        .eq("cooperative_id", coopId!)
        .eq("bonus_eligible", true)
        .order("product_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const runs = useQuery({
    queryKey: ["bonus-runs", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_bonus_runs")
        .select("*")
        .eq("cooperative_id", coopId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const lines = useQuery({
    queryKey: ["bonus-lines", openRunId],
    enabled: Boolean(openRunId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_bonus_lines")
        .select(
          "id, basis_amount, bonus_amount, transaction_id, members(first_name, last_name, member_number), savings_products(product_name)",
        )
        .eq("run_id", openRunId!)
        .order("bonus_amount", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const calculate = useMutation({
    mutationFn: async () => {
      const ratePct = Number(rate);
      if (!Number.isFinite(ratePct) || ratePct <= 0) throw new Error("Enter a bonus rate above zero.");

      const eligibleProducts = (products.data ?? []).map((p) => p.id);
      const productFilter = productId === "ALL" ? eligibleProducts : [productId];
      if (productFilter.length === 0)
        throw new Error("No savings product is marked bonus eligible yet.");

      const { data: accounts, error: accErr } = await supabase
        .from("member_savings_accounts")
        .select("id, member_id, savings_product_id")
        .eq("cooperative_id", coopId!)
        .in("savings_product_id", productFilter)
        .in("status", ["ACTIVE", "DORMANT"]);
      if (accErr) throw accErr;
      if ((accounts ?? []).length === 0) throw new Error("There are no savings accounts to work on.");

      const { data: txs, error: txErr } = await supabase
        .from("savings_transactions")
        .select("savings_account_id, direction, amount, value_date")
        .eq("cooperative_id", coopId!)
        .eq("status", "POSTED")
        .lte("value_date", end);
      if (txErr) throw txErr;

      const closing = new Map<string, number>();
      const opening = new Map<string, number>();
      for (const t of txs ?? []) {
        const signed = (t.direction === "CREDIT" ? 1 : -1) * Number(t.amount);
        closing.set(t.savings_account_id, (closing.get(t.savings_account_id) ?? 0) + signed);
        if (t.value_date < start)
          opening.set(t.savings_account_id, (opening.get(t.savings_account_id) ?? 0) + signed);
      }

      const rows = (accounts ?? [])
        .map((a) => {
          const close = closing.get(a.id) ?? 0;
          const open = opening.get(a.id) ?? 0;
          const basisAmount =
            basis === "AVERAGE_BALANCE" ? round2((open + close) / 2) : round2(close);
          return {
            account: a,
            basisAmount,
            bonusAmount: round2((basisAmount * ratePct) / 100),
          };
        })
        .filter((r) => r.basisAmount > 0 && r.bonusAmount > 0);

      if (rows.length === 0)
        throw new Error("No member has a posted balance in this period, so there is nothing to pay.");

      const { data: run, error: runErr } = await supabase
        .from("savings_bonus_runs")
        .insert({
          cooperative_id: coopId!,
          name: name.trim() || `Savings bonus ${start} to ${end}`,
          savings_product_id: productId === "ALL" ? null : productId,
          period_start: start,
          period_end: end,
          basis,
          rate_percent: ratePct,
          status: "CALCULATED",
          member_count: rows.length,
          total_amount: round2(rows.reduce((s, r) => s + r.bonusAmount, 0)),
        })
        .select("id")
        .single();
      if (runErr) throw runErr;

      const { error: lineErr } = await supabase.from("savings_bonus_lines").insert(
        rows.map((r) => ({
          run_id: run.id,
          cooperative_id: coopId!,
          member_id: r.account.member_id,
          savings_account_id: r.account.id,
          savings_product_id: r.account.savings_product_id,
          basis_amount: r.basisAmount,
          bonus_amount: r.bonusAmount,
        })),
      );
      if (lineErr) throw lineErr;
      return run.id;
    },
    onSuccess: (runId) => {
      toast.success("Bonus calculated. Review it before approving.");
      setOpenRunId(runId);
      void qc.invalidateQueries({ queryKey: ["bonus-runs", coopId] });
    },
    onError: (e) => toast.error(friendlySavingsError(e)),
  });

  const approve = useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase
        .from("savings_bonus_runs")
        .update({ status: "APPROVED", approved_by: user?.id ?? null, approved_at: new Date().toISOString() })
        .eq("id", runId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bonus approved.");
      void qc.invalidateQueries({ queryKey: ["bonus-runs", coopId] });
    },
    onError: (e) => toast.error(friendlySavingsError(e)),
  });

  const post = useMutation({
    mutationFn: async (runId: string) => {
      const { data: runLines, error: lineErr } = await supabase
        .from("savings_bonus_lines")
        .select("id, member_id, savings_account_id, savings_product_id, bonus_amount, transaction_id")
        .eq("run_id", runId);
      if (lineErr) throw lineErr;

      const run = (runs.data ?? []).find((r) => r.id === runId);
      const postDate = run?.period_end ?? new Date().toISOString().slice(0, 10);

      for (const line of runLines ?? []) {
        if (line.transaction_id) continue;
        const txNumber = await nextTransactionNumber(coopId!);
        const { data: tx, error: insErr } = await supabase
          .from("savings_transactions")
          .insert({
            cooperative_id: coopId!,
            member_id: line.member_id,
            savings_account_id: line.savings_account_id,
            savings_product_id: line.savings_product_id,
            transaction_number: txNumber,
            transaction_type: "BONUS_CREDIT",
            direction: "CREDIT",
            amount: line.bonus_amount,
            transaction_date: postDate,
            value_date: postDate,
            source: "SYSTEM",
            description: `Savings bonus — ${run?.name ?? "bonus run"}`,
            status: "POSTED",
            posted_by: user?.id ?? null,
            posted_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        const { error: updErr } = await supabase
          .from("savings_bonus_lines")
          .update({ transaction_id: tx.id })
          .eq("id", line.id);
        if (updErr) throw updErr;
      }

      const { error: runErr } = await supabase
        .from("savings_bonus_runs")
        .update({ status: "POSTED", posted_by: user?.id ?? null, posted_at: new Date().toISOString() })
        .eq("id", runId);
      if (runErr) throw runErr;
    },
    onSuccess: () => {
      toast.success("Bonus posted to member accounts.");
      void qc.invalidateQueries({ queryKey: ["bonus-runs", coopId] });
      void qc.invalidateQueries({ queryKey: ["bonus-lines", openRunId] });
    },
    onError: (e) => toast.error(friendlySavingsError(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings bonus"
        description="Work out the bonus from posted balances, review it, approve it, then post it. Nothing reaches a member's balance until it is posted."
      />

      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New bonus run</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="text-xs">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="2026 savings bonus"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Savings product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All bonus-eligible products</SelectItem>
                  {(products.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.product_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Period start</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Period end</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Balance used</Label>
              <Select value={basis} onValueChange={setBasis}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLOSING_BALANCE">Balance at the end of the period</SelectItem>
                  <SelectItem value="AVERAGE_BALANCE">Average of start and end balance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bonus rate (%)</Label>
              <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={() => calculate.mutate()} disabled={calculate.isPending}>
                {calculate.isPending ? "Calculating…" : "Calculate bonus"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bonus runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {runs.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : (runs.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No bonus runs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(runs.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      {formatDate(r.period_start)} – {formatDate(r.period_end)}
                    </TableCell>
                    <TableCell>{Number(r.rate_percent)}%</TableCell>
                    <TableCell>{r.member_count}</TableCell>
                    <TableCell className="text-right">{formatNaira(r.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "POSTED" ? "default" : "secondary"}>
                        {label(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setOpenRunId(openRunId === r.id ? null : r.id)}
                        >
                          {openRunId === r.id ? "Hide" : "Review"}
                        </Button>
                        {r.status === "CALCULATED" && canApprove && (
                          <Button size="sm" variant="outline" onClick={() => approve.mutate(r.id)}>
                            Approve
                          </Button>
                        )}
                        {r.status === "APPROVED" && canPost && (
                          <Button size="sm" onClick={() => post.mutate(r.id)} disabled={post.isPending}>
                            {post.isPending ? "Posting…" : "Post"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {openRunId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members in this run</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lines.isPending ? (
              <p className="p-6 text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Balance used</TableHead>
                      <TableHead className="text-right">Bonus</TableHead>
                      <TableHead>Posted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(lines.data ?? []).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          {l.members?.first_name} {l.members?.last_name}
                          <span className="block text-xs text-muted-foreground">
                            {l.members?.member_number ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell>{l.savings_products?.product_name}</TableCell>
                        <TableCell className="text-right">{formatNaira(l.basis_amount)}</TableCell>
                        <TableCell className="text-right">{formatNaira(l.bonus_amount)}</TableCell>
                        <TableCell>{l.transaction_id ? "Yes" : "Not yet"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
