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
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDate, formatNaira } from "@/lib/format";
import { downloadCsv, friendlyLoanError, label } from "@/lib/loans";
import {
  REPAYMENT_SOURCES,
  postRepayment,
  repaymentStatusTone,
  reverseRepayment,
  type RepaymentSource,
} from "@/lib/repayments";
import { importPayrollLoanDeductions, recoverFromSavings } from "@/lib/repayments-ops";

export const Route = createFileRoute("/admin/repayments/payments")({
  head: () => ({
    meta: [
      { title: "Loan repayments — CoopOS Nigeria" },
      { name: "description", content: "Record, review and reverse money received against loans." },
      { property: "og:title", content: "Loan repayments — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Record, review and reverse money received against loans.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RepaymentsPage,
});

function RepaymentsPage() {
  const { cooperative, user, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const [loanId, setLoanId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState<RepaymentSource>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [offsetOpen, setOffsetOpen] = useState(false);
  const [offsetLoanId, setOffsetLoanId] = useState("");
  const [offsetAccountId, setOffsetAccountId] = useState("");
  const [offsetAmount, setOffsetAmount] = useState("");
  const [offsetReason, setOffsetReason] = useState("");

  const loans = useQuery({
    queryKey: ["repayable-loans", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("id, loan_number, member_id, total_outstanding, members(first_name, last_name, member_number)")
        .eq("cooperative_id", coopId!)
        .in("status", ["ACTIVE", "RESTRUCTURED", "DEFAULTED"])
        .order("loan_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const repayments = useQuery({
    queryKey: ["repayments", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select(
          "*, loans(loan_number), members(first_name, last_name, member_number)",
        )
        .eq("cooperative_id", coopId!)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const allocations = useQuery({
    queryKey: ["repayment-allocations", selected],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayment_allocations")
        .select("*, loan_schedule_lines(installment_number, due_date)")
        .eq("repayment_id", selected!)
        .order("allocation_sequence");
      if (error) throw error;
      return data ?? [];
    },
  });

  const offsetMember = (loans.data ?? []).find((l) => l.id === offsetLoanId)?.member_id ?? null;

  const savingsAccounts = useQuery({
    queryKey: ["offset-savings-accounts", coopId, offsetMember],
    enabled: Boolean(coopId && offsetMember),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_savings_accounts")
        .select("id, account_number, available_balance, savings_products(name)")
        .eq("cooperative_id", coopId!)
        .eq("member_id", offsetMember!)
        .eq("status", "ACTIVE");
      if (error) throw error;
      return data ?? [];
    },
  });

  const payroll = useMutation({
    mutationFn: async () =>
      importPayrollLoanDeductions({ coopId: coopId!, userId: user?.id ?? null }),
    onSuccess: (r) => {
      if (r.posted === 0 && r.held === 0) toast.info("There are no payroll loan deductions waiting.");
      else
        toast.success(
          `${r.posted} deduction(s) applied (${formatNaira(r.totalPosted)}).` +
            (r.held > 0 ? ` ${r.held} held for review.` : ""),
        );
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const offset = useMutation({
    mutationFn: async () => {
      const loan = (loans.data ?? []).find((l) => l.id === offsetLoanId);
      if (!loan || !loan.member_id) throw new Error("Choose the loan this money is for.");
      if (!offsetAccountId) throw new Error("Choose the savings account to take the money from.");
      const value = Number(offsetAmount);
      if (!offsetReason.trim()) throw new Error("Say why this offset was approved.");
      return recoverFromSavings({
        coopId: coopId!,
        loanId: loan.id,
        memberId: loan.member_id,
        savingsAccountId: offsetAccountId,
        amount: value,
        date: new Date().toISOString().slice(0, 10),
        reason: offsetReason.trim(),
        userId: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Savings applied to the loan.");
      setOffsetOpen(false);
      setOffsetLoanId("");
      setOffsetAccountId("");
      setOffsetAmount("");
      setOffsetReason("");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const record = useMutation({
    mutationFn: async () => {
      const loan = (loans.data ?? []).find((l) => l.id === loanId);
      if (!loan) throw new Error("Choose the loan this money is for.");
      const value = Number(amount);
      if (!(value > 0)) throw new Error("Enter an amount greater than zero.");
      return postRepayment({
        coopId: coopId!,
        loanId: loan.id,
        memberId: loan.member_id,
        amount: value,
        repaymentDate: date,
        source,
        externalReference: reference.trim() || null,
        notes: notes.trim() || null,
        userId: user?.id ?? null,
      });
    },
    onSuccess: (result) => {
      toast.success(
        result.plan.unapplied > 0
          ? `Repayment ${result.repaymentNumber} posted; ${formatNaira(result.plan.unapplied)} could not be applied and is being held.`
          : `Repayment ${result.repaymentNumber} posted and fully applied.`,
      );
      setOpen(false);
      setLoanId("");
      setAmount("");
      setReference("");
      setNotes("");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const reverse = useMutation({
    mutationFn: async (args: { id: string; reason: string }) =>
      reverseRepayment({
        coopId: coopId!,
        repaymentId: args.id,
        reason: args.reason,
        userId: user?.id ?? null,
      }),
    onSuccess: () => {
      toast.success("Repayment reversed. The original record stays in the history.");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const term = search.trim().toLowerCase();
  const rows = (repayments.data ?? []).filter((r) => {
    if (!term) return true;
    const m = r.members as { first_name?: string; last_name?: string; member_number?: string } | null;
    const loan = r.loans as { loan_number?: string } | null;
    return [r.repayment_number, r.external_reference, loan?.loan_number, m?.first_name, m?.last_name, m?.member_number]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(term));
  });

  const canRecord = hasPermission("repayments.create") || hasPermission("repayments.post");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repayments"
        description="Money received against loans, and how each payment was split."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={rows.length === 0}
              onClick={() =>
                downloadCsv(
                  "loan-repayments.csv",
                  rows.map((r) => {
                    const m = r.members as { first_name?: string; last_name?: string } | null;
                    return {
                      receipt: r.repayment_number,
                      loan: (r.loans as { loan_number?: string } | null)?.loan_number ?? "",
                      member: [m?.first_name, m?.last_name].filter(Boolean).join(" "),
                      date: r.repayment_date,
                      amount: r.amount,
                      allocated: r.allocated_amount,
                      unapplied: r.unapplied_amount,
                      source: r.payment_source,
                      status: r.status,
                    };
                  }),
                )
              }
            >
              Export
            </Button>
            <Button
              variant="outline"
              disabled={!canRecord || payroll.isPending}
              onClick={() => payroll.mutate()}
            >
              {payroll.isPending ? "Bringing in…" : "Bring in payroll deductions"}
            </Button>
            <Dialog open={offsetOpen} onOpenChange={setOffsetOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!canRecord}>
                  Apply savings to a loan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Apply savings to a loan</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Loan</Label>
                    <Select value={offsetLoanId} onValueChange={(v) => { setOffsetLoanId(v); setOffsetAccountId(""); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a loan" />
                      </SelectTrigger>
                      <SelectContent>
                        {(loans.data ?? []).map((l) => {
                          const m = l.members as { first_name?: string; last_name?: string } | null;
                          return (
                            <SelectItem key={l.id} value={l.id}>
                              {l.loan_number} — {[m?.first_name, m?.last_name].filter(Boolean).join(" ")}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Savings account</Label>
                    <Select value={offsetAccountId} onValueChange={setOffsetAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an account" />
                      </SelectTrigger>
                      <SelectContent>
                        {(savingsAccounts.data ?? []).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {(a.savings_products as { name?: string } | null)?.name ?? a.account_number} —{" "}
                            {formatNaira(a.available_balance)} available
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={offsetAmount}
                      onChange={(e) => setOffsetAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Why this was approved</Label>
                    <Textarea value={offsetReason} onChange={(e) => setOffsetReason(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => offset.mutate()} disabled={offset.isPending}>
                    {offset.isPending ? "Applying…" : "Apply to the loan"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button disabled={!canRecord}>Record a repayment</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Record a repayment</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Loan</Label>
                    <Select value={loanId} onValueChange={setLoanId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a loan" />
                      </SelectTrigger>
                      <SelectContent>
                        {(loans.data ?? []).map((l) => {
                          const m = l.members as { first_name?: string; last_name?: string } | null;
                          return (
                            <SelectItem key={l.id} value={l.id}>
                              {l.loan_number} — {[m?.first_name, m?.last_name].filter(Boolean).join(" ")} (
                              {formatNaira(l.total_outstanding)})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date received</Label>
                      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Where it came from</Label>
                      <Select value={source} onValueChange={(v) => setSource(v as RepaymentSource)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REPAYMENT_SOURCES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {label(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Reference</Label>
                      <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Explanation</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The payment is applied to the oldest unpaid instalment first, following your
                    cooperative's order of settlement. Anything left over is held rather than guessed at.
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={() => record.mutate()} disabled={record.isPending}>
                    {record.isPending ? "Posting…" : "Post repayment"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by receipt, loan, member or reference"
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-0">
          {repayments.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading repayments…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No repayment has been recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Unapplied</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const m = r.members as { first_name?: string; last_name?: string; member_number?: string } | null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.repayment_number}</TableCell>
                        <TableCell>
                          {[m?.first_name, m?.last_name].filter(Boolean).join(" ") || "—"}
                          <span className="block text-xs text-muted-foreground">{m?.member_number ?? ""}</span>
                        </TableCell>
                        <TableCell>{(r.loans as { loan_number?: string } | null)?.loan_number ?? "—"}</TableCell>
                        <TableCell>{formatDate(r.repayment_date)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNaira(r.amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(r.unapplied_amount) > 0 ? formatNaira(r.unapplied_amount) : "—"}
                        </TableCell>
                        <TableCell>{label(r.payment_source)}</TableCell>
                        <TableCell>
                          <Badge variant={repaymentStatusTone(r.status)}>{label(r.status)}</Badge>
                        </TableCell>
                        <TableCell className="space-x-1 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(r.id)}>
                            Split
                          </Button>
                          {r.status === "POSTED" && hasPermission("repayments.reverse") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const reason = window.prompt("Why is this repayment being reversed?");
                                if (reason && reason.trim()) reverse.mutate({ id: r.id, reason: reason.trim() });
                              }}
                            >
                              Reverse
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>How this payment was applied</DialogTitle>
          </DialogHeader>
          {allocations.isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (allocations.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing was applied from this payment; it is being held as unapplied money.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applied to</TableHead>
                  <TableHead>Instalment</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(allocations.data ?? []).map((a) => {
                  const line = a.loan_schedule_lines as
                    | { installment_number?: number; due_date?: string }
                    | null;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>{label(a.allocation_type)}</TableCell>
                      <TableCell>
                        {line?.installment_number ? `#${line.installment_number}` : "—"}
                        {line?.due_date && (
                          <span className="block text-xs text-muted-foreground">
                            due {formatDate(line.due_date)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(a.amount)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
