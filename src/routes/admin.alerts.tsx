import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/alerts")({
  head: () => ({
    meta: [
      { title: "Staff alerts — CoopOS Nigeria" },
      { name: "description", content: "Payroll, savings and approval alerts for cooperative staff." },
      { property: "og:title", content: "Staff alerts — CoopOS Nigeria" },
      { property: "og:description", content: "Payroll, savings and approval alerts for cooperative staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffAlertsPage,
});

const severityTone = (s: string) =>
  s === "WARNING" ? "destructive" : s === "ACTION" ? "secondary" : "outline";

function StaffAlertsPage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;
  const qc = useQueryClient();
  const [filter, setFilter] = useState("UNREAD");

  const alerts = useQuery({
    queryKey: ["staff-alerts", coopId, filter],
    enabled: Boolean(coopId),
    queryFn: async () => {
      let q = supabase
        .from("staff_notifications")
        .select("*")
        .eq("cooperative_id", coopId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter === "UNREAD") q = q.is("read_at", null);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("staff_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff-alerts"] });
    },
    onError: () => toast.error("That alert could not be updated."),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("staff_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("cooperative_id", coopId!)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All alerts marked as read.");
      void qc.invalidateQueries({ queryKey: ["staff-alerts"] });
    },
    onError: () => toast.error("Those alerts could not be updated."),
  });

  const rows = alerts.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff alerts"
        description="What needs attention: payroll files loaded, checks finished, exceptions, approvals, postings and reversals."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UNREAD">Unread</SelectItem>
                <SelectItem value="ALL">Everything</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              Mark all as read
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="divide-y p-0">
          {alerts.isPending && <p className="p-6 text-sm text-muted-foreground">Loading alerts…</p>}
          {!alerts.isPending && rows.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Nothing needs your attention right now.</p>
          )}
          {rows.map((a) => (
            <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={severityTone(a.severity) as never}>{a.severity}</Badge>
                  <span className="text-sm font-medium">{a.title}</span>
                  {!a.read_at && <span className="text-xs text-primary">New</span>}
                </div>
                {a.body && <p className="text-xs text-muted-foreground">{a.body}</p>}
                <p className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                {a.link && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={a.link}>Open</a>
                  </Button>
                )}
                {!a.read_at && (
                  <Button variant="ghost" size="sm" onClick={() => markRead.mutate(a.id)}>
                    Mark as read
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
