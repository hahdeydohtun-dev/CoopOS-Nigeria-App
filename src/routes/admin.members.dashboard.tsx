import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, UserCog, UserMinus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { statusLabel, type LifecycleStatus } from "@/lib/members";

export const Route = createFileRoute("/admin/members/dashboard")({
  head: () => ({
    meta: [
      { title: "Member dashboard — CoopOS Nigeria" },
      {
        name: "description",
        content:
          "Membership counts by status, category, department and branch for your cooperative society.",
      },
      { property: "og:title", content: "Member dashboard — CoopOS Nigeria" },
      {
        property: "og:description",
        content:
          "Membership counts by status, category, department and branch for your cooperative society.",
      },
    ],
  }),
  component: MemberDashboard,
});

type Row = {
  id: string;
  lifecycle_status: LifecycleStatus;
  branch_id: string | null;
  memberships: { department: string | null; membership_categories: { name: string } | null }[];
};

function tally(entries: (string | null | undefined)[], fallback: string) {
  const counts = new Map<string, number>();
  entries.forEach((raw) => {
    const key = raw && raw.trim() !== "" ? raw.trim() : fallback;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function Breakdown({
  title,
  data,
  loading,
  emptyText,
}: {
  title: string;
  data: { label: string; count: number }[];
  loading: boolean;
  emptyText: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-2/3" />
          </>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          data.map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{row.label}</span>
                <span className="tabular-nums font-medium">{row.count}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MemberDashboard() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const branches = useQuery({
    queryKey: ["branches", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .eq("cooperative_id", coopId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const members = useQuery({
    queryKey: ["member-dashboard", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select(
          "id, lifecycle_status, branch_id, memberships(department, membership_categories(name))",
        )
        .eq("cooperative_id", coopId!);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = members.data ?? [];
  const loading = members.isPending;
  const count = (s: LifecycleStatus) => rows.filter((r) => r.lifecycle_status === s).length;

  const branchNames = new Map((branches.data ?? []).map((b) => [b.id, b.name]));

  const byStatus = tally(
    rows.map((r) => statusLabel[r.lifecycle_status] ?? r.lifecycle_status),
    "Unknown",
  );
  const byCategory = tally(
    rows.map((r) => r.memberships?.[0]?.membership_categories?.name ?? null),
    "No category set",
  );
  const byDepartment = tally(
    rows.map((r) => r.memberships?.[0]?.department ?? null),
    "No department set",
  );
  const byBranch = tally(
    rows.map((r) => (r.branch_id ? (branchNames.get(r.branch_id) ?? "Unknown branch") : null)),
    "No branch set",
  );

  if (!coopId) {
    return (
      <>
        <PageHeader title="Member dashboard" description="Membership at a glance." />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You are not linked to a cooperative yet.
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Member dashboard"
        description="Counts and breakdowns for your cooperative's membership."
        actions={
          <Button variant="outline" asChild>
            <Link to="/admin/members">Open member directory</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/admin/members">
          <StatCard label="Total members" value={rows.length} icon={Users} loading={loading} />
        </Link>
        <Link to="/admin/members" search={{ status: "ACTIVE" }}>
          <StatCard label="Active" value={count("ACTIVE")} icon={UserCheck} loading={loading} />
        </Link>
        <Link to="/admin/members" search={{ status: "PENDING_VERIFICATION" }}>
          <StatCard
            label="Pending verification"
            value={count("PENDING_VERIFICATION")}
            icon={UserCog}
            loading={loading}
          />
        </Link>
        <Link to="/admin/members" search={{ status: "PENDING_APPROVAL" }}>
          <StatCard
            label="Pending approval"
            value={count("PENDING_APPROVAL")}
            icon={UserCog}
            loading={loading}
          />
        </Link>
        <Link to="/admin/members" search={{ status: "SUSPENDED" }}>
          <StatCard
            label="Suspended"
            value={count("SUSPENDED")}
            icon={UserMinus}
            loading={loading}
          />
        </Link>
        <Link to="/admin/members" search={{ status: "DORMANT" }}>
          <StatCard label="Dormant" value={count("DORMANT")} icon={UserMinus} loading={loading} />
        </Link>
        <Link to="/admin/members" search={{ status: "EXITED" }}>
          <StatCard label="Exited" value={count("EXITED")} icon={UserMinus} loading={loading} />
        </Link>
        <Link to="/admin/members" search={{ status: "RETIRED" }}>
          <StatCard label="Retired" value={count("RETIRED")} icon={UserMinus} loading={loading} />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown
          title="By status"
          data={byStatus}
          loading={loading}
          emptyText="No members registered yet."
        />
        <Breakdown
          title="By membership category"
          data={byCategory}
          loading={loading}
          emptyText="No members registered yet."
        />
        <Breakdown
          title="By department"
          data={byDepartment}
          loading={loading}
          emptyText="No members registered yet."
        />
        <Breakdown
          title="By branch"
          data={byBranch}
          loading={loading}
          emptyText="No members registered yet."
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Savings, loan and share figures are not shown here. They will appear once those modules are
        built.
      </p>
    </>
  );
}
