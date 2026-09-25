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
import { formatDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/platform/users")({
  head: () => ({
    meta: [
      { title: "Users — CoopOS Nigeria" },
      { name: "description", content: "Every user account on the platform." },
      { property: "og:title", content: "Users — CoopOS Nigeria" },
      { property: "og:description", content: "Every user account on the platform." },
    ],
  }),
  component: PlatformUsersPage,
});

function PlatformUsersPage() {
  const users = useQuery({
    queryKey: ["platform-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, status, is_platform_user, created_at")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const rows = users.data ?? [];

  return (
    <>
      <PageHeader title="Users" description="Every user account on the platform." />
      <Card>
        <CardContent className="p-4 sm:p-6">
          {users.isPending ? (
            <p className="text-sm text-muted-foreground">Loading users…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.email ?? u.phone ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.is_platform_user ? "default" : "outline"}>
                          {u.is_platform_user ? "Platform" : "Cooperative"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(u.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant={u.status === "ACTIVE" ? "secondary" : "outline"}>
                          {titleCase(u.status)}
                        </Badge>
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
