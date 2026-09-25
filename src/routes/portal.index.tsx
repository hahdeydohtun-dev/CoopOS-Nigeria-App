import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { MemberStatusBadge } from "@/components/member/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { friendlyError, fullName, type LifecycleStatus } from "@/lib/members";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: "Member portal — CoopOS Nigeria" },
      {
        name: "description",
        content: "Your membership at a glance: number, status, category, branch and updates.",
      },
      { property: "og:title", content: "Member portal — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Your membership at a glance: number, status, category, branch and updates.",
      },
    ],
  }),
  component: PortalHome,
});

function PortalHome() {
  const { user } = useSession();

  const me = useQuery({
    queryKey: ["my-member-record", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select(
          "*, memberships(membership_number, membership_type, status, effective_date, department, membership_categories(name), branches(name))",
        )
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const notifications = useQuery({
    queryKey: ["my-notifications", me.data?.id],
    enabled: Boolean(me.data?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_notifications")
        .select("*")
        .eq("member_id", me.data!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (me.isPending) {
    return <p className="text-sm text-muted-foreground">Loading your membership…</p>;
  }
  if (me.isError) {
    return <p className="text-sm text-destructive">{friendlyError(me.error)}</p>;
  }
  if (!me.data) {
    return (
      <>
        <PageHeader
          title="Your cooperative workspace"
          description="Your account is not linked to a membership record yet."
        />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Ask your cooperative's secretary to link your membership to this account, or complete an
            application with them. Once linked, your membership details appear here.
          </CardContent>
        </Card>
      </>
    );
  }

  const member = me.data;
  const membership = member.memberships?.[0] ?? null;

  return (
    <>
      <PageHeader
        title={`Welcome, ${member.preferred_name || member.first_name}`}
        description={fullName(member)}
        actions={<MemberStatusBadge status={member.lifecycle_status as LifecycleStatus} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Membership number" value={member.member_number ?? member.membership_number} />
        <Info label="Category" value={membership?.membership_categories?.name ?? "—"} />
        <Info label="Branch" value={membership?.branches?.name ?? "—"} />
        <Info label="Joined" value={formatDate(member.join_date)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(notifications.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing new right now.</p>
            ) : (
              (notifications.data ?? []).map((n) => (
                <div key={n.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(n.created_at)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/portal/profile">My profile</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/portal/notifications">Notifications</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/portal/statements">Statements</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Savings, loans, shares and withdrawal balances appear here once those modules are built.
          No figures are shown until real accounts exist.
        </CardContent>
      </Card>
    </>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium">{value || "—"}</p>
      </CardContent>
    </Card>
  );
}
