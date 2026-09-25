import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Clock, ShieldAlert, Wallet } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNaira } from "@/lib/format";
import { useSession } from "@/lib/session";
import { label, statusTone, type WithdrawalStatus } from "@/lib/withdrawals";

export const Route = createFileRoute("/admin/withdrawals/")({
  head: () => ({
    meta: [
      { title: "Withdrawals dashboard — CoopOS Nigeria" },
      { name: "description", content: "Withdrawal requests, approvals and payouts at a glance." },
      { property: "og:title", content: "Withdrawals dashboard — CoopOS Nigeria" },
      { property: "og:description", content: "Withdrawal requests, approvals and payouts at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WithdrawalsDashboard,
});

const PENDING: WithdrawalStatus[] = ["SUBMITTED", "UNDER_REVIEW", "CHECKED", "APPROVED", "PAYMENT_PENDING", "PROCESSING"];

function WithdrawalsDashboard() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const requests = useQuery({
    queryKey: ["withdrawal-dashboard", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select(
          "id, withdrawal_number, requested_amount, approved_amount, net_payout_amount, status, request_date, members(first_name, last_name, membership_number), withdrawal_types(name)",
        )
        .eq("cooperative_id", coopId!)
        .order("request_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const exceptions = useQuery({
    queryKey: ["withdrawal-exception-count", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("withdrawal_exceptions")
        .select("id", { count: "exact", head: true })
        .eq("cooperative_id", coopId!)
        .eq("status", "OPEN");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const rows = requests.data ?? [];
  const pending = rows.filter((r) => PENDING.includes(r.status as WithdrawalStatus));
  const paid = rows.filter((r) => r.status === "COMPLETED");
  const pendingValue = pending.reduce((s, r) => s + Number(r.approved_amount ?? r.requested_amount ?? 0), 0);
  const paidValue = paid.reduce((s, r) => s + Number(r.net_payout_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdrawals"
        description="Requests, approvals, payouts and exit settlements."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/withdrawals/types">Withdrawal types</Link>
            </Button>
            <Button asChild>
              <Link to="/admin/withdrawals/pending">Work the queue</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting action" value={pending.length} icon={Clock} loading={requests.isPending} />
        <StatCard label="Value awaiting action" value={formatNaira(pendingValue)} icon={Wallet} loading={requests.isPending} />
        <StatCard label="Paid (last 200)" value={formatNaira(paidValue)} icon={Banknote} loading={requests.isPending} />
        <StatCard label="Open issues" value={exceptions.data ?? 0} icon={ShieldAlert} loading={exceptions.isPending} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latest requests</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 15).map((r) => {
                const member = r.members as { first_name: string; last_name: string } | null;
                const type = r.withdrawal_types as { name: string } | null;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        to="/admin/withdrawals/$withdrawalId"
                        params={{ withdrawalId: r.id }}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {r.withdrawal_number}
                      </Link>
                    </TableCell>
                    <TableCell>{member ? `${member.first_name} ${member.last_name}` : "—"}</TableCell>
                    <TableCell>{type?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(r.requested_amount)}</TableCell>
                    <TableCell>{formatDate(r.request_date)}</TableCell>
                    <TableCell>
                      <Badge variant={statusTone(r.status)}>{label(r.status)}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && !requests.isPending && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No withdrawal requests yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
