import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Landmark, ShieldCheck, Wallet } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDate, formatNaira } from "@/lib/format";
import { APPLICATION_PIPELINE, applicationStatusTone, label } from "@/lib/loans";

export const Route = createFileRoute("/admin/loans/")({
  head: () => ({
    meta: [
      { title: "Loans dashboard — CoopOS Nigeria" },
      { name: "description", content: "Loan pipeline, portfolio and disbursement overview." },
      { property: "og:title", content: "Loans dashboard — CoopOS Nigeria" },
      { property: "og:description", content: "Loan pipeline, portfolio and disbursement overview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoansDashboard,
});

function LoansDashboard() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const data = useQuery({
    queryKey: ["loans-dashboard", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const [apps, loans] = await Promise.all([
        supabase
          .from("loan_applications")
          .select(
            "id, application_number, requested_amount, approved_amount, application_status, application_date, members(first_name, last_name, member_number)",
          )
          .eq("cooperative_id", coopId!)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("loans")
          .select("id, status, disbursed_amount, total_outstanding")
          .eq("cooperative_id", coopId!),
      ]);
      if (apps.error) throw apps.error;
      if (loans.error) throw loans.error;
      return { apps: apps.data ?? [], loans: loans.data ?? [] };
    },
  });

  const apps = data.data?.apps ?? [];
  const loans = data.data?.loans ?? [];
  const pipelineCount = apps.filter((a) =>
    APPLICATION_PIPELINE.includes(a.application_status),
  ).length;
  const awaitingApproval = apps.filter((a) =>
    ["CHECKED", "CREDIT_REVIEW"].includes(a.application_status),
  ).length;
  const awaitingDisbursement = apps.filter((a) =>
    ["APPROVED", "DISBURSEMENT_PENDING"].includes(a.application_status),
  ).length;
  const portfolio = loans.reduce((s, l) => s + Number(l.total_outstanding ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loans"
        description="Applications, credit decisions and the loan book. Balances come from posted loan entries only."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/loans/products">Loan products</Link>
            </Button>
            <Button asChild>
              <Link to="/admin/loans/applications">Applications</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Applications in progress" value={pipelineCount} icon={ClipboardList} loading={data.isPending} />
        <StatCard label="Awaiting approval" value={awaitingApproval} icon={ShieldCheck} loading={data.isPending} />
        <StatCard label="Awaiting disbursement" value={awaitingDisbursement} icon={Wallet} loading={data.isPending} />
        <StatCard label="Loan book outstanding" value={formatNaira(portfolio)} icon={Landmark} loading={data.isPending} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {APPLICATION_PIPELINE.map((s) => (
            <Badge key={s} variant="outline">
              {label(s)}: {apps.filter((a) => a.application_status === s).length}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent applications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : apps.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No loan application has been raised yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {apps.slice(0, 10).map((a) => {
                const m = a.members as { first_name?: string; last_name?: string } | null;
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <Link
                      to="/admin/loans/applications/$applicationId"
                      params={{ applicationId: a.id }}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {a.application_number}
                    </Link>
                    <span>{[m?.first_name, m?.last_name].filter(Boolean).join(" ") || "—"}</span>
                    <span className="tabular-nums">{formatNaira(a.approved_amount ?? a.requested_amount)}</span>
                    <span className="text-muted-foreground">{formatDate(a.application_date)}</span>
                    <Badge variant={applicationStatusTone(a.application_status)}>
                      {label(a.application_status)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
