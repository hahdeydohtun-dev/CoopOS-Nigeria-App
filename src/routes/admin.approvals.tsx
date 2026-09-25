import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDateTime, titleCase } from "@/lib/format";

export const Route = createFileRoute("/admin/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — CoopOS Nigeria" },
      {
        name: "description",
        content: "Maker-checker-approver workflows and pending approval requests.",
      },
      { property: "og:title", content: "Approvals — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Maker-checker-approver workflows and pending approval requests.",
      },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const data = useQuery({
    queryKey: ["approvals", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const [workflows, requests] = await Promise.all([
        supabase
          .from("approval_workflows")
          .select("*, approval_steps(*)")
          .eq("cooperative_id", coopId!),
        supabase
          .from("approval_requests")
          .select("*")
          .eq("cooperative_id", coopId!)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);
      if (workflows.error) throw workflows.error;
      if (requests.error) throw requests.error;
      return { workflows: workflows.data, requests: requests.data };
    },
  });

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Segregation of duties: the person who raises a request can never approve it."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!coopId ? (
            <p className="text-sm text-muted-foreground">
              You are not linked to a cooperative yet.
            </p>
          ) : data.isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : data.data!.workflows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workflow configured yet.</p>
          ) : (
            data.data!.workflows.map((w) => {
              const row = w as Record<string, unknown>;
              const steps = (row["approval_steps"] as Record<string, unknown>[] | null) ?? [];
              return (
                <div key={String(row["id"])} className="rounded-md border p-4">
                  <p className="text-sm font-medium">{String(row["name"] ?? "Workflow")}</p>
                  <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {[...steps]
                      .sort((a, b) => Number(a["step_order"] ?? 0) - Number(b["step_order"] ?? 0))
                      .map((s) => (
                        <li key={String(s["id"])}>
                          {String(s["step_order"] ?? "")}. {titleCase(String(s["step_type"] ?? ""))}
                          {s["required_role"] ? ` — ${titleCase(String(s["required_role"]))}` : ""}
                        </li>
                      ))}
                  </ol>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent requests</CardTitle>
        </CardHeader>
        <CardContent>
          {data.data && data.data.requests.length > 0 ? (
            <ul className="divide-y text-sm">
              {data.data.requests.map((r) => {
                const row = r as Record<string, unknown>;
                return (
                  <li
                    key={String(row["id"])}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <span>{String(row["entity_type"] ?? "Request")}</span>
                    <span className="text-muted-foreground">
                      {formatDateTime(String(row["created_at"] ?? ""))}
                    </span>
                    <Badge variant="outline">{titleCase(String(row["status"] ?? ""))}</Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No approval request has been raised yet.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
