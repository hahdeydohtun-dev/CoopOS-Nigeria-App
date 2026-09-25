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

export const Route = createFileRoute("/platform/cooperatives")({
  head: () => ({
    meta: [
      { title: "Cooperatives — CoopOS Nigeria" },
      { name: "description", content: "Every cooperative society registered on the platform." },
      { property: "og:title", content: "Cooperatives — CoopOS Nigeria" },
      { property: "og:description", content: "Every cooperative society registered on the platform." },
    ],
  }),
  component: CooperativesPage,
});

function CooperativesPage() {
  const cooperatives = useQuery({
    queryKey: ["platform-cooperatives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cooperatives")
        .select("id, legal_name, trading_name, status, is_demo, currency, created_at")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const rows = cooperatives.data ?? [];

  return (
    <>
      <PageHeader
        title="Cooperatives"
        description="Every cooperative society registered on the platform."
      />
      <Card>
        <CardContent className="p-4 sm:p-6">
          {cooperatives.isPending ? (
            <p className="text-sm text-muted-foreground">Loading cooperatives…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cooperatives registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span className="font-medium">{c.trading_name || c.legal_name}</span>
                        {c.trading_name && (
                          <span className="block text-xs text-muted-foreground">{c.legal_name}</span>
                        )}
                        {c.is_demo && (
                          <Badge variant="outline" className="ml-2">
                            Demo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{c.currency}</TableCell>
                      <TableCell className="text-sm">{formatDate(c.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "ACTIVE" ? "secondary" : "outline"}>
                          {titleCase(c.status)}
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
