import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, Coins, Landmark, PiggyBank, ShieldAlert, Wallet } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatNaira, formatNumber } from "@/lib/format";
import {
  loadTrialBalance,
  naturalBalance,
  startOfYear,
  sumBySubtype,
  sumByType,
  today,
} from "@/lib/accounting";

export const Route = createFileRoute("/admin/accounting/")({
  head: () => ({
    meta: [
      { title: "Accounting dashboard — CoopOS Nigeria" },
      {
        name: "description",
        content: "Assets, liabilities, funds, surplus and open accounting issues at a glance.",
      },
      { property: "og:title", content: "Accounting dashboard — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Assets, liabilities, funds, surplus and open accounting issues at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountingDashboard,
});

function AccountingDashboard() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const balances = useQuery({
    queryKey: ["accounting-dashboard", coopId],
    enabled: Boolean(coopId),
    queryFn: () => loadTrialBalance(coopId!, startOfYear(), today()),
  });

  const counts = useQuery({
    queryKey: ["accounting-dashboard-counts", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const [unposted, pending, issues] = await Promise.all([
        supabase
          .from("journal_entries")
          .select("id", { count: "exact", head: true })
          .eq("cooperative_id", coopId!)
          .in("status", ["DRAFT", "SUBMITTED", "CHECKED"]),
        supabase
          .from("journal_entries")
          .select("id", { count: "exact", head: true })
          .eq("cooperative_id", coopId!)
          .eq("status", "APPROVED"),
        supabase
          .from("accounting_exceptions")
          .select("id", { count: "exact", head: true })
          .eq("cooperative_id", coopId!)
          .eq("status", "OPEN"),
      ]);
      return {
        unposted: unposted.count ?? 0,
        pending: pending.count ?? 0,
        issues: issues.count ?? 0,
      };
    },
  });

  const rows = balances.data ?? [];
  const assets = sumByType(rows, "ASSET");
  const liabilities = sumByType(rows, "LIABILITY");
  const equity = sumByType(rows, "EQUITY");
  const income = sumByType(rows, "INCOME");
  const expense = sumByType(rows, "EXPENSE");
  const cash =
    sumBySubtype(rows, "CASH") + sumBySubtype(rows, "BANK");
  const loans = sumBySubtype(rows, "LOANS");
  const savings = sumBySubtype(rows, "SAVINGS");
  const investments = sumBySubtype(rows, "INVESTMENT");
  const suspense = sumBySubtype(rows, "SUSPENSE");

  const empty = rows.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting"
        description="Every figure here comes from posted journals. Nothing is estimated or simulated."
      />

      {empty && !balances.isPending && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-muted-foreground">
              No accounts have been set up yet. Load the sample chart of accounts and the default
              entry rules to get started — you can edit both afterwards.
            </p>
            <Button asChild>
              <Link to="/admin/accounting/accounts">Set up the chart of accounts</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total assets" value={formatNaira(assets)} icon={BookOpenCheck} />
        <StatCard label="Total liabilities" value={formatNaira(liabilities)} icon={Wallet} />
        <StatCard label="Funds & reserves" value={formatNaira(equity)} icon={Coins} />
        <StatCard label="Income this year" value={formatNaira(income)} icon={Coins} />
        <StatCard label="Expenses this year" value={formatNaira(expense)} icon={Coins} />
        <StatCard label="Surplus / deficit" value={formatNaira(income - expense)} icon={Coins} />
        <StatCard label="Cash & bank" value={formatNaira(cash)} icon={Landmark} />
        <StatCard label="Loans receivable" value={formatNaira(loans)} icon={Landmark} />
        <StatCard label="Member savings" value={formatNaira(savings)} icon={PiggyBank} />
        <StatCard label="Investments" value={formatNaira(investments)} icon={Coins} />
        <StatCard label="Suspense balance" value={formatNaira(suspense)} icon={ShieldAlert} />
        <StatCard
          label="Open accounting issues"
          value={formatNumber(counts.data?.issues ?? 0)}
          icon={ShieldAlert}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Work waiting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Journals still being prepared:{" "}
              <span className="font-medium">{formatNumber(counts.data?.unposted ?? 0)}</span>
            </p>
            <p>
              Approved and waiting to be posted:{" "}
              <span className="font-medium">{formatNumber(counts.data?.pending ?? 0)}</span>
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/accounting/journals">Journals</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/accounting/trial-balance">Trial balance</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Largest balances</CardTitle>
          </CardHeader>
          <CardContent>
            {balances.isPending ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {[...rows]
                  .sort((a, b) => Math.abs(naturalBalance(b)) - Math.abs(naturalBalance(a)))
                  .slice(0, 8)
                  .map((r) => (
                    <li key={r.account_id} className="flex items-center justify-between gap-3">
                      <span className="truncate">
                        <span className="font-mono text-xs text-muted-foreground">{r.code}</span>{" "}
                        {r.name}
                      </span>
                      <span className="font-medium">{formatNaira(naturalBalance(r))}</span>
                    </li>
                  ))}
                {rows.length === 0 && (
                  <li className="text-muted-foreground">Nothing has been posted yet.</li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
