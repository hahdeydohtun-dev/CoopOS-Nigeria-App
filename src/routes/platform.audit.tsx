import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/platform/audit")({
  head: () => ({
    meta: [
      { title: "Platform audit — CoopOS Nigeria" },
      { name: "description", content: "Append-only audit trail across the whole platform." },
      { property: "og:title", content: "Platform audit — CoopOS Nigeria" },
      { property: "og:description", content: "Append-only audit trail across the whole platform." },
    ],
  }),
  component: PlatformAuditPage,
});

function PlatformAuditPage() {
  const entries = useQuery({
    queryKey: ["platform-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, module, entity_type, entity_id, created_at, user_id, cooperative_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const rows = entries.data ?? [];

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Append-only record of actions across the whole platform. Entries cannot be edited or deleted."
      />
      <Card>
        <CardContent className="p-4 sm:p-6">
          {entries.isPending ? (
            <p className="text-sm text-muted-foreground">Loading audit trail…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(e.created_at)}
                      </TableCell>
                      <TableCell>
                        {e.module ? <Badge variant="outline">{e.module}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{e.action}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.entity_type ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {e.user_id ? `${e.user_id.slice(0, 8)}…` : "System"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
