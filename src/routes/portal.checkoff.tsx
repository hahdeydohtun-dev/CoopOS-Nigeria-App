import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Clock, PiggyBank } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
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
import { useSession } from "@/lib/session";
import { formatDate, formatNaira, formatNumber } from "@/lib/format";
import { label } from "@/lib/checkoff";

export const Route = createFileRoute("/portal/checkoff")({
  head: () => ({
    meta: [
      { title: "My salary deductions — CoopOS Nigeria" },
      { name: "description", content: "Every deduction your employer has sent to the cooperative on your behalf." },
      { property: "og:title", content: "My salary deductions — CoopOS Nigeria" },
      { property: "og:description", content: "Every deduction your employer has sent to the cooperative on your behalf." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalCheckoffPage,
});

function PortalCheckoffPage() {
  const { user } = useSession();

  const member = useQuery({
    queryKey: ["portal-member", user?.id],
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

  const deductions = useQuery({
    queryKey: ["portal-checkoff", member.data?.id],
    enabled: Boolean(member.data?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkoff_batch_lines")
        .select("*, checkoff_batches(payroll_period, deduction_date, status)")
        .eq("matched_member_id", member.data!.id)
        .order("payroll_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = deductions.data ?? [];
  const posted = rows.filter((r) => r.posting_status === "POSTED");
  const totalPosted = posted.reduce((s, r) => s + Number(r.deduction_amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My salary deductions"
        description="What your employer has deducted and sent to the cooperative."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Deductions received" value={formatNumber(rows.length)} icon={CalendarClock} />
        <StatCard label="Added to my savings" value={formatNaira(totalPosted)} icon={PiggyBank} />
        <StatCard label="Still being processed" value={formatNumber(rows.length - posted.length)} icon={Clock} />
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No salary deductions have reached us for you yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payroll period</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.checkoff_batches?.payroll_period ?? "—"}</TableCell>
                    <TableCell>{formatDate(r.payroll_date ?? r.checkoff_batches?.deduction_date)}</TableCell>
                    <TableCell>{label(r.deduction_type)}</TableCell>
                    <TableCell className="text-right">{formatNaira(r.deduction_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={r.posting_status === "POSTED" ? "default" : "secondary"}>
                        {r.posting_status === "POSTED" ? "Added to savings" : label(r.posting_status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
