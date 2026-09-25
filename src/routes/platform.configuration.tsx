import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/platform/configuration")({
  head: () => ({
    meta: [
      { title: "Configuration — CoopOS Nigeria" },
      { name: "description", content: "Platform roles and the permission catalogue." },
      { property: "og:title", content: "Configuration — CoopOS Nigeria" },
      { property: "og:description", content: "Platform roles and the permission catalogue." },
    ],
  }),
  component: ConfigurationPage,
});

function ConfigurationPage() {
  const roles = useQuery({
    queryKey: ["platform-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("id, key, name, description, is_system")
        .is("cooperative_id", null)
        .order("key");
      if (error) throw error;
      return data;
    },
  });

  const permissions = useQuery({
    queryKey: ["platform-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("id, code, description")
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <PageHeader
        title="Configuration"
        description="Built-in roles and the permission catalogue every cooperative inherits."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Built-in roles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {roles.isPending ? (
            <p className="text-sm text-muted-foreground">Loading roles…</p>
          ) : (
            (roles.data ?? []).map((r) => (
              <div key={r.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-medium">{r.name}</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {r.key}
                </Badge>
                {r.description && (
                  <span className="text-muted-foreground">{r.description}</span>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permission catalogue</CardTitle>
        </CardHeader>
        <CardContent>
          {permissions.isPending ? (
            <p className="text-sm text-muted-foreground">Loading permissions…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(permissions.data ?? []).map((p) => (
                <Badge key={p.id} variant="secondary" className="font-mono text-xs">
                  {p.code}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
