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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { applyRestructure } from "@/lib/repayments-ops";
import { useSession } from "@/lib/session";
import { formatDate, formatNaira } from "@/lib/format";
import { friendlyLoanError, label } from "@/lib/loans";
import { calculateSettlement, unexpiredInterest, type ScheduleLineRow } from "@/lib/repayments";

export const Route = createFileRoute("/admin/repayments/workflows")({
  head: () => ({
    meta: [
      { title: "Waivers & settlements — CoopOS Nigeria" },
      {
        name: "description",
        content: "Late charge waivers, early settlement quotes, restructures and write-offs.",
      },
      { property: "og:title", content: "Waivers & settlements — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Late charge waivers, early settlement quotes, restructures and write-offs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkflowsPage,
});

const PENDING = ["REQUESTED", "UNDER_REVIEW", "CHECKED"];

function WorkflowsPage() {
  const { cooperative, user, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const queryClient = useQueryClient();

  const loans = useQuery({
    queryKey: ["workflow-loans", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select(
          "id, loan_number, member_id, outstanding_principal, outstanding_interest, outstanding_fees, outstanding_penalties, total_outstanding, loan_products(early_repayment_policy), members(first_name, last_name)",
        )
        .eq("cooperative_id", coopId!)
        .in("status", ["ACTIVE", "RESTRUCTURED", "DEFAULTED"])
        .order("loan_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const lists = useQuery({
    queryKey: ["loan-workflows", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const [waivers, quotes, restructures, writeOffs] = await Promise.all([
        supabase
          .from("loan_penalty_waivers")
          .select("*, loans(loan_number), members(first_name, last_name)")
          .eq("cooperative_id", coopId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("loan_settlement_quotes")
          .select("*, loans(loan_number), members(first_name, last_name)")
          .eq("cooperative_id", coopId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("loan_restructures")
          .select("*, loans(loan_number), members(first_name, last_name)")
          .eq("cooperative_id", coopId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("loan_write_offs")
          .select("*, loans(loan_number), members(first_name, last_name)")
          .eq("cooperative_id", coopId!)
          .order("created_at", { ascending: false }),
      ]);
      return {
        waivers: waivers.data ?? [],
        quotes: quotes.data ?? [],
        restructures: restructures.data ?? [],
        writeOffs: writeOffs.data ?? [],
      };
    },
  });

  const decide = useMutation({
    mutationFn: async (args: { table: string; id: string; status: string; notes?: string }) => {
      const patch = {
        status: args.status as "APPROVED" | "REJECTED",
        decision_notes: args.notes ?? null,
        approved_by: args.status === "APPROVED" ? (user?.id ?? null) : null,
      };
      const { error } = await supabase
        .from(args.table as "loan_penalty_waivers")
        .update(patch)
        .eq("id", args.id);
      if (error) throw error;

      // An approved restructure takes effect straight away: the old plan is kept
      // as history and a new repayment plan becomes the current one.
      if (args.table === "loan_restructures" && args.status === "APPROVED") {
        await applyRestructure({
          coopId: coopId!,
          restructureId: args.id,
          userId: user?.id ?? null,
        });
      }
    },
    onSuccess: () => {
      toast.success("Decision saved.");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const name = (m: unknown) => {
    const v = m as { first_name?: string; last_name?: string } | null;
    return [v?.first_name, v?.last_name].filter(Boolean).join(" ") || "—";
  };

  const canApprove = hasPermission("repayments.approve");

  const DecisionCell = ({ table, row, permission }: { table: string; row: { id: string; status: string }; permission: boolean }) =>
    PENDING.includes(row.status) && permission ? (
      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => decide.mutate({ table, id: row.id, status: "APPROVED" })}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const reason = window.prompt("Why is this being declined?");
            if (reason && reason.trim())
              decide.mutate({ table, id: row.id, status: "REJECTED", notes: reason.trim() });
          }}
        >
          Decline
        </Button>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waivers & settlements"
        description="Requests that change what a member owes. Nothing here happens without a decision on record."
      />

      <Tabs defaultValue="settlements">
        <TabsList className="flex-wrap">
          <TabsTrigger value="settlements">Early settlement</TabsTrigger>
          <TabsTrigger value="waivers">Charge waivers</TabsTrigger>
          <TabsTrigger value="restructures">Restructures</TabsTrigger>
          <TabsTrigger value="writeoffs">Write-offs</TabsTrigger>
        </TabsList>

        <TabsContent value="settlements" className="mt-4 space-y-4">
          <SettlementQuoteBuilder
            coopId={coopId}
            userId={user?.id ?? null}
            loans={loans.data ?? []}
            onDone={() => queryClient.invalidateQueries()}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quotes issued</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(lists.data?.quotes ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No quote has been issued.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Loan</TableHead>
                      <TableHead className="text-right">Amount to settle</TableHead>
                      <TableHead>Valid until</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(lists.data?.quotes ?? []).map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">{q.quote_number}</TableCell>
                        <TableCell>{name(q.members)}</TableCell>
                        <TableCell>{(q.loans as { loan_number?: string } | null)?.loan_number}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNaira(q.settlement_amount)}</TableCell>
                        <TableCell>{q.expiry_date ? formatDate(q.expiry_date) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{label(q.status)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waivers" className="mt-4 space-y-4">
          <RequestForm
            title="Request a charge waiver"
            coopId={coopId}
            userId={user?.id ?? null}
            loans={loans.data ?? []}
            table="loan_penalty_waivers"
            onDone={() => queryClient.invalidateQueries()}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Waiver requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(lists.data?.waivers ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No waiver has been requested.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Loan</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(lists.data?.waivers ?? []).map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>{name(w.members)}</TableCell>
                        <TableCell>{(w.loans as { loan_number?: string } | null)?.loan_number}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNaira(w.amount)}</TableCell>
                        <TableCell className="max-w-xs text-sm text-muted-foreground">{w.reason}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{label(w.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DecisionCell
                            table="loan_penalty_waivers"
                            row={w}
                            permission={hasPermission("repayments.waive_penalty") && canApprove}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restructures" className="mt-4 space-y-4">
          <RequestForm
            title="Request a restructure"
            coopId={coopId}
            userId={user?.id ?? null}
            loans={loans.data ?? []}
            table="loan_restructures"
            onDone={() => queryClient.invalidateQueries()}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Restructure requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(lists.data?.restructures ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No restructure has been requested.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Loan</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(lists.data?.restructures ?? []).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{name(r.members)}</TableCell>
                        <TableCell>{(r.loans as { loan_number?: string } | null)?.loan_number}</TableCell>
                        <TableCell>{label(r.restructure_type ?? "")}</TableCell>
                        <TableCell className="max-w-xs text-sm text-muted-foreground">{r.reason}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{label(r.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DecisionCell
                            table="loan_restructures"
                            row={r}
                            permission={hasPermission("repayments.restructure") && canApprove}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="writeoffs" className="mt-4 space-y-4">
          <RequestForm
            title="Request a write-off"
            coopId={coopId}
            userId={user?.id ?? null}
            loans={loans.data ?? []}
            table="loan_write_offs"
            onDone={() => queryClient.invalidateQueries()}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Write-off requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(lists.data?.writeOffs ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No write-off has been requested.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Loan</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(lists.data?.writeOffs ?? []).map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>{name(w.members)}</TableCell>
                        <TableCell>{(w.loans as { loan_number?: string } | null)?.loan_number}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNaira(w.amount)}</TableCell>
                        <TableCell className="max-w-xs text-sm text-muted-foreground">{w.reason}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{label(w.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DecisionCell
                            table="loan_write_offs"
                            row={w}
                            permission={hasPermission("repayments.write_off") && canApprove}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type LoanOption = {
  id: string;
  loan_number: string;
  member_id: string | null;
  outstanding_principal: number;
  outstanding_interest: number;
  outstanding_fees: number;
  outstanding_penalties: number;
  total_outstanding: number;
  loan_products: unknown;
  members: unknown;
};

function LoanPicker({
  loans,
  value,
  onChange,
}: {
  loans: LoanOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Choose a loan" />
      </SelectTrigger>
      <SelectContent>
        {loans.map((l) => {
          const m = l.members as { first_name?: string; last_name?: string } | null;
          return (
            <SelectItem key={l.id} value={l.id}>
              {l.loan_number} — {[m?.first_name, m?.last_name].filter(Boolean).join(" ")}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function RequestForm({
  title,
  coopId,
  userId,
  loans,
  table,
  onDone,
}: {
  title: string;
  coopId: string | null;
  userId: string | null;
  loans: LoanOption[];
  table: "loan_penalty_waivers" | "loan_restructures" | "loan_write_offs";
  onDone: () => void;
}) {
  const [loanId, setLoanId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState("TENURE_EXTENSION");

  const submit = useMutation({
    mutationFn: async () => {
      const loan = loans.find((l) => l.id === loanId);
      if (!loan) throw new Error("Choose the loan first.");
      if (!reason.trim()) throw new Error("Give a reason.");
      const base = {
        cooperative_id: coopId!,
        loan_id: loan.id,
        member_id: loan.member_id,
        reason: reason.trim(),
        status: "REQUESTED" as const,
        requested_by: userId,
      };
      if (table === "loan_restructures") {
        const { error } = await supabase.from("loan_restructures").insert({
          ...base,
          created_by: userId,
          restructure_type: type,
          old_terms: {
            outstanding_principal: loan.outstanding_principal,
            outstanding_interest: loan.outstanding_interest,
          },
        });
        if (error) throw error;
        return;
      }
      const value = Number(amount);
      if (!(value > 0)) throw new Error("Enter an amount greater than zero.");
      if (table === "loan_penalty_waivers") {
        if (value > Number(loan.outstanding_penalties))
          throw new Error("You cannot waive more than the charges outstanding.");
        const { error } = await supabase.from("loan_penalty_waivers").insert({ ...base, amount: value });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loan_write_offs").insert({
          ...base,
          created_by: userId,
          amount: value,
          principal_component: loan.outstanding_principal,
          interest_component: loan.outstanding_interest,
          fee_component: loan.outstanding_fees,
          penalty_component: loan.outstanding_penalties,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Request submitted for a decision.");
      setLoanId("");
      setAmount("");
      setReason("");
      onDone();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Loan</Label>
          <LoanPicker loans={loans} value={loanId} onChange={setLoanId} />
        </div>
        {table === "loan_restructures" ? (
          <div className="space-y-1.5">
            <Label>What should change</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TENURE_EXTENSION">Longer repayment period</SelectItem>
                <SelectItem value="FREQUENCY_CHANGE">Different payment frequency</SelectItem>
                <SelectItem value="RATE_CHANGE">Different interest rate</SelectItem>
                <SelectItem value="PAYMENT_HOLIDAY">A break from payments</SelectItem>
                <SelectItem value="ARREARS_CAPITALISATION">Roll arrears into the loan</SelectItem>
                <SelectItem value="INSTALMENT_CHANGE">Smaller instalments</SelectItem>
                <SelectItem value="PARTIAL_SETTLEMENT">Part settlement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Reason</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </div>
        <div>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            Submit request
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SettlementQuoteBuilder({
  coopId,
  userId,
  loans,
  onDone,
}: {
  coopId: string | null;
  userId: string | null;
  loans: LoanOption[];
  onDone: () => void;
}) {
  const [loanId, setLoanId] = useState("");
  const loan = loans.find((l) => l.id === loanId) ?? null;

  const lines = useQuery({
    queryKey: ["settlement-lines", loanId],
    enabled: Boolean(loanId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_schedule_lines")
        .select("id, installment_number, due_date, principal, interest, fees, total_due, paid_principal, paid_interest, paid_fees, status, loan_schedules!inner(loan_id, status)")
        .eq("loan_schedules.loan_id", loanId)
        .eq("loan_schedules.status", "ACTIVE")
        .order("installment_number");
      if (error) throw error;
      return (data ?? []) as unknown as ScheduleLineRow[];
    },
  });

  const policy = String(
    (loan?.loan_products as { early_repayment_policy?: string } | null)?.early_repayment_policy ?? "",
  ).toUpperCase();
  const refundAllowed = policy !== "" && !policy.includes("NO");

  const quote =
    loan && lines.data
      ? calculateSettlement({
          outstandingPrincipal: Number(loan.outstanding_principal),
          outstandingInterest: Number(loan.outstanding_interest),
          outstandingFees: Number(loan.outstanding_fees),
          outstandingPenalties: Number(loan.outstanding_penalties),
          unexpiredInterest: unexpiredInterest(lines.data),
          refundAllowed,
          chargePercent: 0,
        })
      : null;

  const save = useMutation({
    mutationFn: async () => {
      if (!loan || !quote) throw new Error("Choose a loan first.");
      const today = new Date();
      const expiry = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
      const { error } = await supabase.from("loan_settlement_quotes").insert({
        cooperative_id: coopId!,
        loan_id: loan.id,
        member_id: loan.member_id,
        quote_number: `SQ-${today.toISOString().slice(0, 10).replace(/-/g, "")}-${loan.loan_number}`,
        requested_by: userId,
        request_date: today.toISOString().slice(0, 10),
        settlement_date: today.toISOString().slice(0, 10),
        outstanding_principal: quote.outstandingPrincipal,
        accrued_interest: quote.accruedInterest,
        outstanding_fees: quote.outstandingFees,
        outstanding_penalties: quote.outstandingPenalties,
        gross_interest_refund: quote.grossInterestRefund,
        applicable_charges: quote.applicableCharges,
        net_interest_refund: quote.netInterestRefund,
        settlement_amount: quote.settlementAmount,
        expiry_date: expiry,
        policy_basis: quote.policyBasis,
        status: "REQUESTED",
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settlement quote saved.");
      onDone();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Work out an early settlement figure</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-md space-y-1.5">
          <Label>Loan</Label>
          <LoanPicker loans={loans} value={loanId} onChange={setLoanId} />
        </div>
        {quote && (
          <div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
            <Row k="Outstanding principal" v={formatNaira(quote.outstandingPrincipal)} />
            <Row k="Interest owed" v={formatNaira(quote.accruedInterest)} />
            <Row k="Fees owed" v={formatNaira(quote.outstandingFees)} />
            <Row k="Late charges owed" v={formatNaira(quote.outstandingPenalties)} />
            <Row k="Interest refund" v={formatNaira(quote.netInterestRefund)} />
            <Row k="Amount to settle today" v={formatNaira(quote.settlementAmount)} />
            <p className="text-xs text-muted-foreground sm:col-span-2">{quote.policyBasis}</p>
          </div>
        )}
        <Button onClick={() => save.mutate()} disabled={!quote || save.isPending}>
          Save quote
        </Button>
      </CardContent>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}
