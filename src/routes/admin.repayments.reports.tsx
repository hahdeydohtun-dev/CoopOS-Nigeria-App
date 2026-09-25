import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { downloadCsv, label } from "@/lib/loans";
import { loadPortfolio, loadRepaymentRules, percentOf, portfolioKpis } from "@/lib/repayments";

export const Route = createFileRoute("/admin/repayments/reports")({
  head: () => ({
    meta: [
      { title: "Repayment reports — CoopOS Nigeria" },
      { name: "description", content: "Collections, arrears ageing, portfolio at risk and recovery reporting." },
      { property: "og:title", content: "Repayment reports — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Collections, arrears ageing, portfolio at risk and recovery reporting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RepaymentReportsPage,
});

function RepaymentReportsPage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const collections = useQuery({
    queryKey: ["repayment-report-collections", coopId, from, to],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("repayment_number, repayment_date, amount, allocated_amount, unapplied_amount, payment_source, status, loans(loan_number), members(first_name, last_name, member_number)")
        .eq("cooperative_id", coopId!)
        .gte("repayment_date", from)
        .lte("repayment_date", to)
        .order("repayment_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const portfolio = useQuery({
    queryKey: ["repayment-portfolio", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const rules = await loadRepaymentRules(coopId!);
      const rows = await loadPortfolio(coopId!, rules);
      return { rules, rows, kpis: portfolioKpis(rows) };
    },
  });

  const name = (m: unknown) => {
    const v = m as { first_name?: string; last_name?: string } | null;
    return [v?.first_name, v?.last_name].filter(Boolean).join(" ") || "—";
  };

  const posted = (collections.data ?? []).filter((r) => r.status === "POSTED");
  const total = posted.reduce((s, r) => s + Number(r.amount), 0);
  const bySource = Object.entries(
    posted.reduce<Record<string, number>>((acc, r) => {
      acc[r.payment_source] = (acc[r.payment_source] ?? 0) + Number(r.amount);
      return acc;
    }, {}),
  );

  const kpis = portfolio.data?.kpis;
  const rows = portfolio.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repayment reports"
        description="Every figure comes from posted repayments and the live schedules — nothing is estimated."
      />

      <Tabs defaultValue="collections">
        <TabsList className="flex-wrap">
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="ageing">Arrears ageing</TabsTrigger>
          <TabsTrigger value="risk">Portfolio at risk</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="text-base">
                  {formatNaira(total)} collected across {posted.length} payment(s)
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {bySource.map(([s, v]) => `${label(s)}: ${formatNaira(v)}`).join(" · ") || "No money received in this period."}
                </p>
              </div>
              <div className="flex items-end gap-2">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
                <Button
                  variant="outline"
                  disabled={posted.length === 0}
                  onClick={() =>
                    downloadCsv(
                      `collections-${from}-to-${to}.csv`,
                      posted.map((r) => ({
                        receipt: r.repayment_number,
                        date: r.repayment_date,
                        member: name(r.members),
                        loan: (r.loans as { loan_number?: string } | null)?.loan_number ?? "",
                        amount: r.amount,
                        applied: r.allocated_amount,
                        unapplied: r.unapplied_amount,
                        source: r.payment_source,
                      })),
                    )
                  }
                >
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {posted.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No repayment was posted in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Loan</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posted.map((r) => (
                      <TableRow key={r.repayment_number}>
                        <TableCell className="font-medium">{r.repayment_number}</TableCell>
                        <TableCell>{formatDate(r.repayment_date)}</TableCell>
                        <TableCell>{name(r.members)}</TableCell>
                        <TableCell>{(r.loans as { loan_number?: string } | null)?.loan_number}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNaira(r.amount)}</TableCell>
                        <TableCell>{label(r.payment_source)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ageing" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Arrears ageing</CardTitle>
              <Button
                variant="outline"
                size="sm"
                disabled={rows.length === 0}
                onClick={() =>
                  downloadCsv(
                    "arrears-ageing.csv",
                    rows.map((r) => ({
                      loan: r.loanNumber,
                      member: r.memberName,
                      days_late: r.arrears.daysPastDue,
                      principal_arrears: r.arrears.principalArrears,
                      interest_arrears: r.arrears.interestArrears,
                      fee_arrears: r.arrears.feeArrears,
                      total_arrears: r.arrears.totalArrears,
                      band: r.band,
                    })),
                  )
                }
              >
                Export
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Band</TableHead>
                    <TableHead className="text-right">Loans</TableHead>
                    <TableHead className="text-right">Arrears</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(portfolio.data?.rules.dpdBands ?? []).map((b) => {
                    const inBand = rows.filter((r) =>
                      b.to === null
                        ? r.arrears.daysPastDue >= b.from
                        : r.arrears.daysPastDue >= b.from && r.arrears.daysPastDue <= b.to,
                    );
                    return (
                      <TableRow key={b.label}>
                        <TableCell>{b.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{inBand.length}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNaira(inBand.reduce((s, r) => s + r.arrears.totalArrears, 0))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portfolio at risk</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Measure</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Share of book</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["Outstanding portfolio", kpis?.totalOutstanding ?? 0],
                    ["PAR 1", kpis?.par1 ?? 0],
                    ["PAR 30", kpis?.par30 ?? 0],
                    ["PAR 60", kpis?.par60 ?? 0],
                    ["PAR 90", kpis?.par90 ?? 0],
                    ["Non-performing", kpis?.nplAmount ?? 0],
                  ].map(([k, v]) => (
                    <TableRow key={String(k)}>
                      <TableCell>{String(k)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(Number(v))}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {percentOf(Number(v), kpis?.totalOutstanding ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
