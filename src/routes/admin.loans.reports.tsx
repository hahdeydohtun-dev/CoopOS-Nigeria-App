import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Route = createFileRoute("/admin/loans/reports")({
  head: () => ({
    meta: [
      { title: "Loan reports — CoopOS Nigeria" },
      { name: "description", content: "Applications, portfolio, disbursements and guarantor exposure." },
      { property: "og:title", content: "Loan reports — CoopOS Nigeria" },
      { property: "og:description", content: "Applications, portfolio, disbursements and guarantor exposure." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoanReportsPage,
});

function LoanReportsPage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const data = useQuery({
    queryKey: ["loan-reports", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const [apps, loans, guarantees, disbursements] = await Promise.all([
        supabase
          .from("loan_applications")
          .select("application_number, requested_amount, approved_amount, application_status, application_date, members(first_name, last_name, member_number), loan_products(product_name)")
          .eq("cooperative_id", coopId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("loans")
          .select("loan_number, disbursed_amount, total_outstanding, status, maturity_date, members(first_name, last_name, member_number), loan_products(product_name)")
          .eq("cooperative_id", coopId!),
        supabase
          .from("loan_guarantors")
          .select("amount_guaranteed, status, members:guarantor_member_id(first_name, last_name, member_number)")
          .eq("cooperative_id", coopId!)
          .eq("status", "ACCEPTED"),
        supabase
          .from("loan_transactions")
          .select("transaction_number, amount, transaction_date, loans(loan_number), members(first_name, last_name)")
          .eq("cooperative_id", coopId!)
          .eq("transaction_type", "DISBURSEMENT")
          .order("transaction_date", { ascending: false }),
      ]);
      return {
        apps: apps.data ?? [],
        loans: loans.data ?? [],
        guarantees: guarantees.data ?? [],
        disbursements: disbursements.data ?? [],
      };
    },
  });

  const name = (m: unknown) => {
    const v = m as { first_name?: string; last_name?: string } | null;
    return [v?.first_name, v?.last_name].filter(Boolean).join(" ") || "—";
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Loan reports" description="Every figure comes from saved applications and posted loan entries." />

      <Tabs defaultValue="applications">
        <TabsList className="flex-wrap">
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="disbursements">Disbursements</TabsTrigger>
          <TabsTrigger value="guarantors">Guarantor exposure</TabsTrigger>
          <TabsTrigger value="payroll">Payroll deductions</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="mt-4">
          <ReportCard
            title="Applications"
            rows={(data.data?.apps ?? []).map((a) => ({
              application: a.application_number,
              member: name(a.members),
              product: (a.loan_products as { product_name?: string } | null)?.product_name ?? "",
              requested: a.requested_amount,
              approved: a.approved_amount ?? "",
              status: a.application_status,
              date: a.application_date,
            }))}
            columns={["application", "member", "product", "requested", "approved", "status", "date"]}
            money={["requested", "approved"]}
            dates={["date"]}
          />
        </TabsContent>

        <TabsContent value="portfolio" className="mt-4">
          <ReportCard
            title="Loan portfolio"
            rows={(data.data?.loans ?? []).map((l) => ({
              loan: l.loan_number,
              member: name(l.members),
              product: (l.loan_products as { product_name?: string } | null)?.product_name ?? "",
              disbursed: l.disbursed_amount,
              outstanding: l.total_outstanding,
              status: l.status,
              maturity: l.maturity_date ?? "",
            }))}
            columns={["loan", "member", "product", "disbursed", "outstanding", "status", "maturity"]}
            money={["disbursed", "outstanding"]}
            dates={["maturity"]}
          />
        </TabsContent>

        <TabsContent value="disbursements" className="mt-4">
          <ReportCard
            title="Disbursements"
            rows={(data.data?.disbursements ?? []).map((t) => ({
              entry: t.transaction_number ?? "",
              loan: (t.loans as { loan_number?: string } | null)?.loan_number ?? "",
              member: name(t.members),
              amount: t.amount,
              date: t.transaction_date,
            }))}
            columns={["entry", "loan", "member", "amount", "date"]}
            money={["amount"]}
            dates={["date"]}
          />
        </TabsContent>

        <TabsContent value="guarantors" className="mt-4">
          <ReportCard
            title="Guarantor exposure"
            rows={(data.data?.guarantees ?? []).map((g) => ({
              guarantor: name(g.members),
              amount: g.amount_guaranteed,
              status: g.status,
            }))}
            columns={["guarantor", "amount", "status"]}
            money={["amount"]}
            dates={[]}
          />
        </TabsContent>

        <TabsContent value="payroll" className="mt-4">
          <PayrollDeductions coopId={coopId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportCard({
  title,
  rows,
  columns,
  money,
  dates,
}: {
  title: string;
  rows: Record<string, unknown>[];
  columns: string[];
  money: string[];
  dates: string[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button
          variant="outline"
          size="sm"
          disabled={rows.length === 0}
          onClick={() => downloadCsv(`${title.toLowerCase().replace(/\s+/g, "-")}.csv`, rows)}
        >
          Export
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nothing to report yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c}>{label(c)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => (
                      <TableCell key={c} className={money.includes(c) ? "text-right tabular-nums" : ""}>
                        {r[c] === "" || r[c] === null || r[c] === undefined
                          ? "—"
                          : money.includes(c)
                            ? formatNaira(r[c] as number)
                            : dates.includes(c)
                              ? formatDate(String(r[c]))
                              : label(String(r[c]))}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PayrollDeductions({ coopId }: { coopId: string | null }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const start = `${month}-01`;
  const end = (() => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y!, m!, 1));
    return d.toISOString().slice(0, 10);
  })();

  const q = useQuery({
    queryKey: ["loan-payroll", coopId, month],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_schedule_lines")
        .select(
          "due_date, installment_number, principal, interest, fees, total_due, paid_principal, paid_interest, paid_fees, loan_schedules!inner(status, loans!inner(loan_number, status, members(first_name, last_name, member_number)))",
        )
        .eq("cooperative_id", coopId!)
        .gte("due_date", start)
        .lt("due_date", end)
        .order("due_date");
      if (error) throw error;
      return (data ?? []).filter((r) => {
        const sched = r.loan_schedules as { status?: string; loans?: { status?: string } } | null;
        return sched?.status === "ACTIVE" && sched?.loans?.status === "ACTIVE";
      });
    },
  });

  const rows = (q.data ?? []).map((r) => {
    const loan = (r.loan_schedules as { loans?: Record<string, unknown> } | null)?.loans ?? {};
    const m = (loan["members"] ?? null) as
      | { first_name?: string; last_name?: string; member_number?: string }
      | null;
    const outstanding =
      Number(r.total_due) - Number(r.paid_principal) - Number(r.paid_interest) - Number(r.paid_fees);
    return {
      member_number: m?.member_number ?? "",
      member: [m?.first_name, m?.last_name].filter(Boolean).join(" "),
      loan: String(loan["loan_number"] ?? ""),
      installment: r.installment_number,
      due_date: r.due_date,
      principal: r.principal,
      interest: r.interest,
      fees: r.fees,
      amount_due: Math.max(0, outstanding),
    };
  });

  const total = rows.reduce((s, r) => s + Number(r.amount_due), 0);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Expected loan deductions for payroll</CardTitle>
          <p className="text-sm text-muted-foreground">
            {rows.length} instalment{rows.length === 1 ? "" : "s"} · {formatNaira(total)} expected
          </p>
        </div>
        <div className="flex items-end gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button variant="outline" disabled={rows.length === 0} onClick={() => downloadCsv(`loan-deductions-${month}.csv`, rows)}>
            Export for payroll
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {q.isPending ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No loan repayment falls due in this month.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Loan</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={`${r.loan}-${r.installment}-${i}`}>
                  <TableCell>
                    {r.member}
                    <span className="block text-xs text-muted-foreground">{r.member_number}</span>
                  </TableCell>
                  <TableCell>{r.loan}</TableCell>
                  <TableCell>{formatDate(r.due_date)}</TableCell>
                  <TableCell className="text-right">{formatNaira(Number(r.amount_due))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
