import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession, roleLabel } from "@/lib/session";
import { formatDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/admin/administration")({
  head: () => ({
    meta: [
      { title: "Users & roles — CoopOS Nigeria" },
      { name: "description", content: "Who has access to your cooperative and with which role." },
      { property: "og:title", content: "Users & roles — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Who has access to your cooperative and with which role.",
      },
    ],
  }),
  component: AdministrationPage,
});

function AdministrationPage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const data = useQuery({
    queryKey: ["administration", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const [access, roles, branches] = await Promise.all([
        supabase
          .from("user_roles")
          .select("id, user_id, role, status, created_at")
          .eq("cooperative_id", coopId!),
        supabase.from("roles").select("id, key, name, description").order("name"),
        supabase.from("branches").select("id, name, code").eq("cooperative_id", coopId!),
      ]);
      if (access.error) throw access.error;
      return { access: access.data, roles: roles.data ?? [], branches: branches.data ?? [] };
    },
  });

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Access is granted by role. Roles carry permissions; permissions drive what each screen shows."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">People with access</CardTitle>
        </CardHeader>
        <CardContent>
          {!coopId ? (
            <p className="text-sm text-muted-foreground">
              You are not linked to a cooperative yet.
            </p>
          ) : data.isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : data.data!.access.length === 0 ? (
            <p className="text-sm text-muted-foreground">No access has been granted yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.data!.access.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 py-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    {a.user_id.slice(0, 8)}…
                  </span>
                  <span className="font-medium">{roleLabel(a.role)}</span>
                  <Badge variant={a.status === "ACTIVE" ? "secondary" : "outline"}>
                    {titleCase(a.status)}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    Granted {formatDate(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branches</CardTitle>
        </CardHeader>
        <CardContent>
          {data.data && data.data.branches.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {data.data.branches.map((b) => (
                <li key={b.id}>
                  <span className="font-medium">{b.name}</span>{" "}
                  <span className="text-muted-foreground">({b.code})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No branch recorded.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Built-in roles</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {(data.data?.roles ?? []).map((r) => (
              <li key={r.id} className="rounded-md border p-3">
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.description ?? r.key}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
