import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { friendlyError } from "@/lib/members";

export const Route = createFileRoute("/portal/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — CoopOS Nigeria" },
      {
        name: "description",
        content: "Updates from your cooperative about your membership and requests.",
      },
      { property: "og:title", content: "Notifications — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Updates from your cooperative about your membership and requests.",
      },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ["my-member-record", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const notifications = useQuery({
    queryKey: ["my-notifications-all", me.data?.id],
    enabled: Boolean(me.data?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_notifications")
        .select("*")
        .eq("member_id", me.data!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("member_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-notifications-all"] }),
  });

  const rows = notifications.data ?? [];

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Everything your cooperative has sent you about your membership."
      />
      <Card>
        <CardContent className="space-y-3 p-6">
          {me.isPending || notifications.isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : notifications.isError ? (
            <p className="text-sm text-destructive">{friendlyError(notifications.error)}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no notifications yet.</p>
          ) : (
            rows.map((n) => (
              <div key={n.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{n.title}</p>
                  {n.read_at ? (
                    <Badge variant="outline">Read</Badge>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)}>
                      Mark as read
                    </Button>
                  )}
                </div>
                {n.body && <p className="mt-1 text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(n.created_at)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
