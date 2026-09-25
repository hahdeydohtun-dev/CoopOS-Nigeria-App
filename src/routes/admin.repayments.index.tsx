import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  Percent,
  Receipt,
  TrendingDown,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
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
import {
  loadPortfolio,
  loadRepaymentRules,
  percentOf,
  portfolioKpis,
  priorityTone,
} from "@/lib/repayments";

export const Route = createFileRoute("/admin/repayments/")({
  head: () => ({
    meta: [
      { title: "Collections dashboard — CoopOS Nigeria" },
      {
        name: "description",
        content: "Loan collections, arrears, portfolio at risk and overdue accounts at a glance.",
      },
      { property: "og:title", content: "Collections dashboard — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Loan collections, arrears, portfolio at risk and overdue accounts at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RepaymentsDashboard,
});

function RepaymentsDashboard() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const portfolio = useQuery({
    queryKey: ["repayment-portfolio", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const rules = await loadRepaymentRules(coopId!);
      const rows = await loadPortfolio(coopId!, rules);
      return { rules, rows, kpis: portfolioKpis(rows) };
    },
  });

  const collected = useQuery({
    queryKey: ["repayments-collected", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const month = new Date().toISOString().slice(0, 7);
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("amount, repayment_date, status")
        .eq("cooperative_id", coopId!)
        .eq("status", "POSTED")
        .gte("repayment_date", `${month}-01`);
      if (error) throw error;
      return (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
    },
  });

  const cases = useQuery({
    queryKey: ["collection-cases-open", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_cases")
        .select("id, case_number, priority, status, days_past_due, arrears_amount, members(first_name, last_name)")
        .eq("cooperative_id", coopId!)
        .not("status", "in", "(RESOLVED,CLOSED)")
        .order("days_past_due", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const kpis = portfolio.data?.kpis;
  const rows = portfolio.data?.rows ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const dueBy = (cutoff: string) =>
    rows.reduce(
      (s, r) =>
        s + (r.arrears.nextDueDate && r.arrears.nextDueDate <= cutoff ? r.arrears.nextDueAmount : 0),
      0,
    );

  const overdue = [...rows]
    .filter((r) => r.arrears.daysPastDue > 0)
    .sort((a, b) => b.arrears.daysPastDue - a.arrears.daysPastDue)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections"
        description="Every figure is worked out from posted loan entries and the live repayment schedules."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/repayments/payments">Record a repayment</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/repayments/delinquency">Delinquency</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/repayments/cases">Collection cases</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Outstanding portfolio"
          value={formatNaira(kpis?.totalOutstanding ?? 0)}
          icon={Banknote}
          loading={portfolio.isPending}
        />
        <StatCard
          label="Collected this month"
          value={formatNaira(collected.data ?? 0)}
          icon={Receipt}
          loading={collected.isPending}
        />
        <StatCard
          label="Total arrears"
          value={formatNaira(kpis?.totalArrears ?? 0)}
          hint={`${kpis?.overdueLoans ?? 0} loan(s) overdue`}
          icon={AlertTriangle}
          loading={portfolio.isPending}
        />
        <StatCard
          label="Due this week"
          value={formatNaira(dueBy(weekEnd))}
          hint={`${formatNaira(dueBy(today))} due today`}
          icon={CalendarClock}
          loading={portfolio.isPending}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="PAR 1"
          value={formatNaira(kpis?.par1 ?? 0)}
          hint={percentOf(kpis?.par1 ?? 0, kpis?.totalOutstanding ?? 0)}
          icon={Percent}
          loading={portfolio.isPending}
        />
        <StatCard
          label="PAR 30"
          value={formatNaira(kpis?.par30 ?? 0)}
          hint={percentOf(kpis?.par30 ?? 0, kpis?.totalOutstanding ?? 0)}
          icon={Percent}
          loading={portfolio.isPending}
        />
        <StatCard
          label="PAR 90"
          value={formatNaira(kpis?.par90 ?? 0)}
          hint={percentOf(kpis?.par90 ?? 0, kpis?.totalOutstanding ?? 0)}
          icon={Percent}
          loading={portfolio.isPending}
        />
        <StatCard
          label="Non-performing"
          value={formatNaira(kpis?.nplAmount ?? 0)}
          hint={`${kpis?.nplRate ?? 0}% of the book · from ${portfolio.data?.rules.nplThreshold ?? 90} days late`}
          icon={TrendingDown}
          loading={portfolio.isPending}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most overdue loans</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {portfolio.isPending ? (
              <p className="p-6 text-sm text-muted-foreground">Loading…</p>
            ) : overdue.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nothing is overdue.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead className="text-right">Arrears</TableHead>
                    <TableHead className="text-right">Days late</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdue.map((r) => (
                    <TableRow key={r.loanId}>
                      <TableCell>
                        {r.memberName}
                        <span className="block text-xs text-muted-foreground">{r.memberNumber}</span>
                      </TableCell>
                      <TableCell>{r.loanNumber}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNaira(r.arrears.totalArrears)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.arrears.daysPastDue}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open collection cases</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {cases.isPending ? (
              <p className="p-6 text-sm text-muted-foreground">Loading…</p>
            ) : (cases.data ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No case is open.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Arrears</TableHead>
                    <TableHead>Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(cases.data ?? []).map((c) => {
                    const m = c.members as { first_name?: string; last_name?: string } | null;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.case_number}</TableCell>
                        <TableCell>{[m?.first_name, m?.last_name].filter(Boolean).join(" ")}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNaira(c.arrears_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={priorityTone(c.priority)}>{c.priority}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Amount due this month: {formatNaira(dueBy(monthEnd))} · as at {formatDate(new Date())}
      </p>
    </div>
  );
}
