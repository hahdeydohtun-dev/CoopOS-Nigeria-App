import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { label } from "@/lib/withdrawals";

export const Route = createFileRoute("/admin/withdrawals/reports")({
  head: () => ({
    meta: [
      { title: "Withdrawal reports — CoopOS Nigeria" },
      { name: "description", content: "Withdrawals by period, type and status, ready to export." },
      { property: "og:title", content: "Withdrawal reports — CoopOS Nigeria" },
      { property: "og:description", content: "Withdrawals by period, type and status, ready to export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WithdrawalReportsPage,
});

const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

function WithdrawalReportsPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const rows = useQuery({
    queryKey: ["withdrawal-report", coopId, from, to],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select(
          "withdrawal_number, request_date, status, requested_amount, approved_amount, fee_amount, net_payout_amount, members(first_name, last_name, membership_number), withdrawal_types(name)",
        )
        .eq("cooperative_id", coopId!)
        .gte("request_date", from)
        .lte("request_date", to)
        .order("request_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const data = rows.data ?? [];
  const byType = new Map<string, { count: number; value: number }>();
  for (const r of data) {
    const name = (r.withdrawal_types as { name: string } | null)?.name ?? "Other";
    const entry = byType.get(name) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += Number(r.approved_amount ?? r.requested_amount ?? 0);
    byType.set(name, entry);
  }

  const exportCsv = () => {
    const header = "Number,Date,Member,Membership number,Type,Status,Requested,Approved,Charge,Net payout";
    const lines = data.map((r) => {
      const m = r.members as { first_name: string; last_name: string; membership_number: string } | null;
      const t = (r.withdrawal_types as { name: string } | null)?.name ?? "";
      return [
        r.withdrawal_number,
        r.request_date,
        m ? `${m.first_name} ${m.last_name}` : "",
        m?.membership_number ?? "",
        t,
        r.status,
        r.requested_amount,
        r.approved_amount ?? "",
        r.fee_amount,
        r.net_payout_amount,
      ].join(",");
    });
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `withdrawals-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdrawal reports"
        description="Withdrawals raised in a period, with totals by type."
        actions={
          <Button onClick={exportCsv} disabled={!hasPermission("withdrawals.export") || data.length === 0}>
            Export
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By withdrawal type</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(byType.entries()).map(([name, v]) => (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.count}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNaira(v.value)}</TableCell>
                </TableRow>
              ))}
              {byType.size === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    Nothing in this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Every request</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead className="text-right">Net payout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => {
                const m = r.members as { first_name: string; last_name: string } | null;
                return (
                  <TableRow key={r.withdrawal_number}>
                    <TableCell>{r.withdrawal_number}</TableCell>
                    <TableCell>{formatDate(r.request_date)}</TableCell>
                    <TableCell>{m ? `${m.first_name} ${m.last_name}` : "—"}</TableCell>
                    <TableCell>{label(r.status)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(r.requested_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(r.net_payout_amount)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
