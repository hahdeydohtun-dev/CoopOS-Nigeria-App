import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, Settings, ShieldCheck, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Cooperative admin dashboard — CoopOS Nigeria" },
      {
        name: "description",
        content: "Members, accounting, approvals and rules for your cooperative society.",
      },
      { property: "og:title", content: "Cooperative admin dashboard — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Members, accounting, approvals and rules for your cooperative society.",
      },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const counts = useQuery({
    queryKey: ["admin-dashboard", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const [members, accounts, rules, workflows] = await Promise.all([
        supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("cooperative_id", coopId!)
          .eq("status", "ACTIVE"),
        supabase
          .from("chart_of_accounts")
          .select("id", { count: "exact", head: true })
          .eq("cooperative_id", coopId!),
        supabase
          .from("cooperative_rules")
          .select("id", { count: "exact", head: true })
          .eq("cooperative_id", coopId!)
          .eq("active", true),
        supabase
          .from("approval_workflows")
          .select("id", { count: "exact", head: true })
          .eq("cooperative_id", coopId!),
      ]);
      return {
        members: members.count ?? 0,
        accounts: accounts.count ?? 0,
        rules: rules.count ?? 0,
        workflows: workflows.count ?? 0,
      };
    },
  });

  return (
    <>
      <PageHeader
        title="Cooperative dashboard"
        description={
          cooperative
            ? `${cooperative.trading_name ?? cooperative.legal_name} — foundation status`
            : "You are not linked to a cooperative yet."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active members"
          value={counts.data?.members}
          icon={Users}
          loading={counts.isPending && Boolean(coopId)}
          unavailable={!coopId}
        />
        <StatCard
          label="Ledger accounts"
          value={counts.data?.accounts}
          icon={BookOpenCheck}
          loading={counts.isPending && Boolean(coopId)}
          unavailable={!coopId}
        />
        <StatCard
          label="Active rules"
          value={counts.data?.rules}
          icon={Settings}
          loading={counts.isPending && Boolean(coopId)}
          unavailable={!coopId}
        />
        <StatCard
          label="Approval workflows"
          value={counts.data?.workflows}
          icon={ShieldCheck}
          loading={counts.isPending && Boolean(coopId)}
          unavailable={!coopId}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phase 1 foundation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Member records, the chart of accounts, configurable rules, approval workflows and the
            audit trail are live. Savings, loans, repayments and treasury screens are deliberately
            left as marked placeholders — nothing on them is simulated.
          </p>
          <p>
            Financial figures stay blank until real posted transactions exist, so no number you see
            here is invented.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
