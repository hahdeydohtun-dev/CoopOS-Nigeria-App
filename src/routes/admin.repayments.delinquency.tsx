import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { downloadCsv, friendlyLoanError } from "@/lib/loans";
import {
  collectionPriority,
  loadPortfolio,
  loadRepaymentRules,
  nextCaseNumber,
  percentOf,
  portfolioKpis,
} from "@/lib/repayments";

export const Route = createFileRoute("/admin/repayments/delinquency")({
  head: () => ({
    meta: [
      { title: "Delinquency & arrears — CoopOS Nigeria" },
      { name: "description", content: "Days past due, arrears ageing, portfolio at risk and non-performing loans." },
      { property: "og:title", content: "Delinquency & arrears — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Days past due, arrears ageing, portfolio at risk and non-performing loans.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DelinquencyPage,
});

function DelinquencyPage() {
  const { cooperative, user, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const queryClient = useQueryClient();

  const portfolio = useQuery({
    queryKey: ["repayment-portfolio", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const rules = await loadRepaymentRules(coopId!);
      const rows = await loadPortfolio(coopId!, rules);
      return { rules, rows, kpis: portfolioKpis(rows) };
    },
  });

  const existingCases = useQuery({
    queryKey: ["collection-case-loans", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_cases")
        .select("loan_id, status")
        .eq("cooperative_id", coopId!)
        .not("status", "in", "(RESOLVED,CLOSED)");
      if (error) throw error;
      return new Set((data ?? []).map((c) => c.loan_id));
    },
  });

  const snapshot = useMutation({
    mutationFn: async () => {
      const data = portfolio.data;
      if (!data) throw new Error("Nothing to record yet.");
      const today = new Date().toISOString().slice(0, 10);
      const rows = data.rows.map((r) => ({
        cooperative_id: coopId!,
        loan_id: r.loanId,
        member_id: r.memberId,
        snapshot_date: today,
        days_past_due: r.arrears.daysPastDue,
        maximum_days_past_due: r.arrears.daysPastDue,
        earliest_overdue_date: r.arrears.earliestOverdueDate,
        outstanding_principal: r.outstandingPrincipal,
        outstanding_interest: r.outstandingInterest,
        outstanding_fees: r.outstandingFees,
        outstanding_penalties: r.outstandingPenalties,
        principal_arrears: r.arrears.principalArrears,
        interest_arrears: r.arrears.interestArrears,
        fee_arrears: r.arrears.feeArrears,
        total_arrears: r.arrears.totalArrears,
        par_bucket: r.parBucket,
        delinquency_status: r.band,
        npl: r.npl,
        rule_used: `Grace ${data.rules.graceDays} day(s); non-performing from ${data.rules.nplThreshold} days late.`,
      }));
      if (rows.length === 0) return 0;
      const { error } = await supabase
        .from("loan_delinquency_snapshots")
        .upsert(rows, { onConflict: "loan_id,snapshot_date" });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => toast.success(`Today's position saved for ${count} loan(s).`),
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const runDaily = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("run_loan_daily_maintenance", {});
      if (error) throw error;
      return data as { snapshots?: number; penalties?: number; notices?: number };
    },
    onSuccess: (r) => {
      toast.success(
        `Updated ${r?.snapshots ?? 0} loan(s); ${r?.penalties ?? 0} late charge(s) added and ${r?.notices ?? 0} reminder(s) sent.`,
      );
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const openCase = useMutation({
    mutationFn: async (loanId: string) => {
      const row = portfolio.data?.rows.find((r) => r.loanId === loanId);
      if (!row) throw new Error("Loan not found.");
      const caseNumber = await nextCaseNumber(coopId!);
      const { error } = await supabase.from("collection_cases").insert({
        cooperative_id: coopId!,
        case_number: caseNumber,
        loan_id: row.loanId,
        member_id: row.memberId,
        delinquency_stage: row.band,
        priority: collectionPriority({
          daysPastDue: row.arrears.daysPastDue,
          arrears: row.arrears.totalArrears,
          outstanding: row.totalOutstanding,
          missedInstallments: row.missedInstallments,
        }),
        days_past_due: row.arrears.daysPastDue,
        arrears_amount: row.arrears.totalArrears,
        outstanding_amount: row.totalOutstanding,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      return caseNumber;
    },
    onSuccess: (caseNumber) => {
      toast.success(`Collection case ${caseNumber} opened.`);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const rules = portfolio.data?.rules;
  const rows = portfolio.data?.rows ?? [];
  const kpis = portfolio.data?.kpis;

  const buckets = (rules?.dpdBands ?? []).map((band) => {
    const inBand = rows.filter((r) =>
      band.to === null
        ? r.arrears.daysPastDue >= band.from
        : r.arrears.daysPastDue >= band.from && r.arrears.daysPastDue <= band.to,
    );
    return {
      label: band.label,
      loans: inBand.length,
      principal: inBand.reduce((s, r) => s + r.outstandingPrincipal, 0),
      arrears: inBand.reduce((s, r) => s + r.arrears.totalArrears, 0),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delinquency & arrears"
        description="Days late are counted from the earliest unpaid instalment, never from the last payment."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={rows.length === 0}
              onClick={() =>
                downloadCsv(
                  "arrears.csv",
                  rows.map((r) => ({
                    loan: r.loanNumber,
                    member: r.memberName,
                    member_number: r.memberNumber,
                    outstanding: r.totalOutstanding,
                    principal_arrears: r.arrears.principalArrears,
                    interest_arrears: r.arrears.interestArrears,
                    fee_arrears: r.arrears.feeArrears,
                    total_arrears: r.arrears.totalArrears,
                    days_late: r.arrears.daysPastDue,
                    band: r.band,
                    par_bucket: r.parBucket,
                    non_performing: r.npl ? "Yes" : "No",
                  })),
                )
              }
            >
              Export
            </Button>
            <Button
              onClick={() => snapshot.mutate()}
              disabled={snapshot.isPending || rows.length === 0}
            >
              {snapshot.isPending ? "Saving…" : "Save today's position"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => runDaily.mutate()}
              disabled={runDaily.isPending || !hasPermission("repayments.post")}
            >
              {runDaily.isPending ? "Updating…" : "Run daily update now"}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portfolio by days late</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Band</TableHead>
                <TableHead className="text-right">Loans</TableHead>
                <TableHead className="text-right">Outstanding principal</TableHead>
                <TableHead className="text-right">Arrears</TableHead>
                <TableHead className="text-right">Share of book</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buckets.map((b) => (
                <TableRow key={b.label}>
                  <TableCell>{b.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.loans}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNaira(b.principal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNaira(b.arrears)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {percentOf(b.principal, kpis?.totalOutstanding ?? 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loans in arrears</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {portfolio.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.filter((r) => r.arrears.totalArrears > 0).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nothing is in arrears.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Arrears</TableHead>
                    <TableHead className="text-right">Days late</TableHead>
                    <TableHead>Band</TableHead>
                    <TableHead>Since</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows
                    .filter((r) => r.arrears.totalArrears > 0)
                    .sort((a, b) => b.arrears.daysPastDue - a.arrears.daysPastDue)
                    .map((r) => (
                      <TableRow key={r.loanId}>
                        <TableCell>
                          {r.memberName}
                          <span className="block text-xs text-muted-foreground">{r.memberNumber}</span>
                        </TableCell>
                        <TableCell>{r.loanNumber}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNaira(r.totalOutstanding)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNaira(r.arrears.totalArrears)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.arrears.daysPastDue}</TableCell>
                        <TableCell>
                          <Badge variant={r.npl ? "destructive" : "secondary"}>{r.band}</Badge>
                        </TableCell>
                        <TableCell>
                          {r.arrears.earliestOverdueDate ? formatDate(r.arrears.earliestOverdueDate) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {existingCases.data?.has(r.loanId) ? (
                            <span className="text-xs text-muted-foreground">Case open</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!hasPermission("collections.manage") || openCase.isPending}
                              onClick={() => openCase.mutate(r.loanId)}
                            >
                              Open case
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
