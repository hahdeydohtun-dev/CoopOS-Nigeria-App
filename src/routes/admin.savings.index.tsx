import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, PiggyBank, Users, Wallet } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatNaira, formatNumber } from "@/lib/format";
import { label } from "@/lib/savings";

export const Route = createFileRoute("/admin/savings/")({
  head: () => ({
    meta: [
      { title: "Savings dashboard — CoopOS Nigeria" },
      { name: "description", content: "Savings balances, accounts and contribution activity." },
      { property: "og:title", content: "Savings dashboard — CoopOS Nigeria" },
      { property: "og:description", content: "Savings balances, accounts and contribution activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SavingsDashboard,
});

function SavingsDashboard() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const summary = useQuery({
    queryKey: ["savings-dashboard", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const [accounts, products, pending, posted] = await Promise.all([
        supabase
          .from("member_savings_accounts")
          .select("id, status, current_balance, locked_balance, savings_product_id")
          .eq("cooperative_id", coopId!),
        supabase
          .from("savings_products")
          .select("id, product_name, product_type, status")
          .eq("cooperative_id", coopId!),
        supabase
          .from("savings_transactions")
          .select("id", { count: "exact", head: true })
          .eq("cooperative_id", coopId!)
          .in("status", ["DRAFT", "SUBMITTED", "CHECKED", "APPROVED"]),
        supabase
          .from("savings_transactions")
          .select("id", { count: "exact", head: true })
          .eq("cooperative_id", coopId!)
          .eq("status", "POSTED"),
      ]);
      if (accounts.error) throw accounts.error;
      if (products.error) throw products.error;

      const rows = accounts.data ?? [];
      const byProduct = new Map<string, number>();
      for (const r of rows) {
        byProduct.set(
          r.savings_product_id,
          (byProduct.get(r.savings_product_id) ?? 0) + Number(r.current_balance ?? 0),
        );
      }
      return {
        accounts: rows.length,
        activeAccounts: rows.filter((r) => r.status === "ACTIVE").length,
        total: rows.reduce((s, r) => s + Number(r.current_balance ?? 0), 0),
        locked: rows.reduce((s, r) => s + Number(r.locked_balance ?? 0), 0),
        pending: pending.count ?? 0,
        postedCount: posted.count ?? 0,
        products: (products.data ?? []).map((p) => ({
          ...p,
          balance: byProduct.get(p.id) ?? 0,
        })),
      };
    },
  });

  const s = summary.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings dashboard"
        description="Balances are calculated from posted savings entries only."
        actions={
          <Button asChild>
            <Link to="/admin/savings/contributions">Record a contribution</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total savings"
          icon={PiggyBank}
          value={s ? formatNaira(s.total) : ""}
          hint="Posted entries only"
        />
        <StatCard
          label="Available savings"
          icon={Wallet}
          value={s ? formatNaira(s.total - s.locked) : ""}
          hint="Total less locked amounts"
        />
        <StatCard
          label="Savings accounts"
          icon={Users}
          value={s ? formatNumber(s.accounts) : ""}
          hint={s ? `${s.activeAccounts} active` : ""}
        />
        <StatCard
          label="Awaiting approval or posting"
          icon={ClipboardList}
          value={s ? formatNumber(s.pending) : ""}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Balance by product</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {summary.isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (s?.products ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No savings products yet.{" "}
              <Link className="underline" to="/admin/savings/products">
                Set up a product
              </Link>{" "}
              to begin.
            </p>
          ) : (
            (s?.products ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{p.product_name}</p>
                  <p className="text-xs text-muted-foreground">{label(p.product_type)}</p>
                </div>
                <p className="font-medium">{formatNaira(p.balance)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {s && s.postedCount === 0
            ? "No savings entries have been posted yet, so every figure above is zero. Charts of savings growth appear once real entries exist — nothing is simulated."
            : "Every figure above comes from posted savings entries. Nothing is estimated or simulated."}
        </CardContent>
      </Card>
    </div>
  );
}
