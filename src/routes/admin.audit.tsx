import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDateTime, titleCase } from "@/lib/format";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit trail — CoopOS Nigeria" },
      { name: "description", content: "Every recorded change in your cooperative, in order." },
      { property: "og:title", content: "Audit trail — CoopOS Nigeria" },
      { property: "og:description", content: "Every recorded change in your cooperative, in order." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const logs = useQuery({
    queryKey: ["audit", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, entity_type, module, created_at, reason")
        .eq("cooperative_id", coopId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Append-only record of changes. Entries cannot be edited or deleted."
      />
      <Card>
        <CardContent className="p-4 sm:p-6">
          {!coopId ? (
            <p className="text-sm text-muted-foreground">
              You are not linked to a cooperative yet.
            </p>
          ) : logs.isPending ? (
            <p className="text-sm text-muted-foreground">Loading audit trail…</p>
          ) : (logs.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has been recorded yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {logs.data!.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-2 py-3">
                  <Badge variant="outline">{titleCase(entry.action)}</Badge>
                  <span className="font-medium">{entry.entity_type ?? "—"}</span>
                  {entry.module && (
                    <span className="text-muted-foreground">{titleCase(entry.module)}</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(entry.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
