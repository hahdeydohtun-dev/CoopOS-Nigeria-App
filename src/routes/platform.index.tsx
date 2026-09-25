import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, ScrollText, ShieldCheck, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/platform/")({
  head: () => ({
    meta: [
      { title: "Platform dashboard — CoopOS Nigeria" },
      { name: "description", content: "Overview of all cooperatives on CoopOS Nigeria." },
      { property: "og:title", content: "Platform dashboard — CoopOS Nigeria" },
      { property: "og:description", content: "Overview of all cooperatives on CoopOS Nigeria." },
    ],
  }),
  component: PlatformDashboard,
});

async function countRows(table: "cooperatives" | "profiles" | "audit_logs") {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

function PlatformDashboard() {
  const stats = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const [cooperatives, users, auditEntries] = await Promise.all([
        countRows("cooperatives"),
        countRows("profiles"),
        countRows("audit_logs"),
      ]);
      const { count: demoCount } = await supabase
        .from("cooperatives")
        .select("id", { count: "exact", head: true })
        .eq("is_demo", true);
      return { cooperatives, users, auditEntries, demoCooperatives: demoCount ?? 0 };
    },
  });

  return (
    <>
      <PageHeader
        title="Platform dashboard"
        description="All cooperative societies running on CoopOS Nigeria."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cooperatives"
          value={stats.data?.cooperatives}
          icon={Building2}
          loading={stats.isPending}
          hint={stats.data ? `${stats.data.demoCooperatives} demo` : undefined}
        />
        <StatCard label="Registered users" value={stats.data?.users} icon={Users} loading={stats.isPending} />
        <StatCard
          label="Audit entries"
          value={stats.data?.auditEntries}
          icon={ScrollText}
          loading={stats.isPending}
        />
        <StatCard
          label="Financial volume"
          icon={ShieldCheck}
          unavailable
          hint="No financial transactions exist yet — nothing is simulated."
        />
      </div>
    </>
  );
}
