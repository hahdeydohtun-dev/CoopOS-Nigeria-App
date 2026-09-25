import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { downloadCsv, label, toCsv } from "@/lib/checkoff";

export const Route = createFileRoute("/admin/checkoff/reports")({
  head: () => ({
    meta: [
      { title: "Check-off reports — CoopOS Nigeria" },
      { name: "description", content: "Batch summary, member deductions, unmatched rows, variances and settlement." },
      { property: "og:title", content: "Check-off reports — CoopOS Nigeria" },
      { property: "og:description", content: "Batch summary, member deductions, unmatched rows, variances and settlement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoffReportsPage,
});

function CheckoffReportsPage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const batches = useQuery({
    queryKey: ["checkoff-report-batches", coopId, from, to],
    enabled: Boolean(coopId),
    queryFn: async () => {
      let q = supabase
        .from("checkoff_batches")
        .select("*, checkoff_profiles(employer_name)")
        .eq("cooperative_id", coopId!)
        .order("deduction_date", { ascending: false });
      if (from) q = q.gte("deduction_date", from);
      if (to) q = q.lte("deduction_date", to);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const batchIds = useMemo(() => (batches.data ?? []).map((b) => b.id), [batches.data]);

  const lines = useQuery({
    queryKey: ["checkoff-report-lines", batchIds.join(",")],
    enabled: batchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkoff_batch_lines")
        .select("*, members(first_name, last_name, member_number), checkoff_batches(batch_number, payroll_period)")
        .in("batch_id", batchIds)
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const settlements = useQuery({
    queryKey: ["checkoff-report-settlements", batchIds.join(",")],
    enabled: batchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkoff_settlements")
        .select("*, checkoff_batches(batch_number, payroll_period)")
        .in("batch_id", batchIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = lines.data ?? [];
  const unmatched = rows.filter((r) => !r.matched_member_id);
  const variances = rows.filter((r) => Number(r.variance_amount ?? 0) !== 0);

  const byType = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    rows.forEach((r) => {
      const key = r.deduction_type;
      const cur = map.get(key) ?? { count: 0, amount: 0 };
      map.set(key, { count: cur.count + 1, amount: cur.amount + Number(r.deduction_amount) });
    });
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader title="Check-off reports" description="Filter by deduction date, then export any list." />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
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

      <Tabs defaultValue="batches">
        <TabsList className="flex-wrap">
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="members">Member deductions</TabsTrigger>
          <TabsTrigger value="unmatched">Unmatched</TabsTrigger>
          <TabsTrigger value="variance">Variances</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
          <TabsTrigger value="types">By deduction type</TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="pt-4">
          <ReportCard
            title="Batch summary"
            onExport={() =>
              downloadCsv(
                "checkoff-batches.csv",
                toCsv([
                  ["Batch", "Employer", "Payroll period", "Deduction date", "Rows", "Total", "Posted", "Status"],
                  ...(batches.data ?? []).map((b) => [
                    b.batch_number,
                    b.checkoff_profiles?.employer_name,
                    b.payroll_period,
                    b.deduction_date,
                    b.total_records,
                    b.total_gross_amount,
                    b.total_posted_amount,
                    b.status,
                  ]),
                ]),
              )
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Employer</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Posted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(batches.data ?? []).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.batch_number}</TableCell>
                    <TableCell>{b.checkoff_profiles?.employer_name ?? "—"}</TableCell>
                    <TableCell>{b.payroll_period}</TableCell>
                    <TableCell>{formatDate(b.deduction_date)}</TableCell>
                    <TableCell className="text-right">{formatNumber(b.total_records)}</TableCell>
                    <TableCell className="text-right">{formatNaira(b.total_gross_amount)}</TableCell>
                    <TableCell className="text-right">{formatNaira(b.total_posted_amount)}</TableCell>
                    <TableCell>{label(b.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="members" className="pt-4">
          <ReportCard
            title="Member deductions"
            onExport={() =>
              downloadCsv(
                "checkoff-member-deductions.csv",
                toCsv([
                  ["Batch", "Period", "Member", "Member number", "Type", "Amount", "Expected", "Difference", "Posting"],
                  ...rows.map((r) => [
                    r.checkoff_batches?.batch_number,
                    r.checkoff_batches?.payroll_period,
                    r.members ? `${r.members.first_name} ${r.members.last_name}` : r.employee_name,
                    r.members?.member_number ?? r.member_number,
                    r.deduction_type,
                    r.deduction_amount,
                    r.expected_amount,
                    r.variance_amount,
                    r.posting_status,
                  ]),
                ]),
              )
            }
          >
            <LineTable rows={rows.slice(0, 300)} />
          </ReportCard>
        </TabsContent>

        <TabsContent value="unmatched" className="pt-4">
          <ReportCard
            title={`Unmatched rows (${unmatched.length})`}
            onExport={() =>
              downloadCsv(
                "checkoff-unmatched.csv",
                toCsv([
                  ["Batch", "Employee", "Identifier", "Type", "Amount"],
                  ...unmatched.map((r) => [
                    r.checkoff_batches?.batch_number,
                    r.employee_name,
                    r.member_number ?? r.employee_id ?? r.staff_number,
                    r.deduction_type,
                    r.deduction_amount,
                  ]),
                ]),
              )
            }
          >
            <LineTable rows={unmatched.slice(0, 300)} />
          </ReportCard>
        </TabsContent>

        <TabsContent value="variance" className="pt-4">
          <ReportCard
            title={`Rows that differ from the schedule (${variances.length})`}
            onExport={() =>
              downloadCsv(
                "checkoff-variances.csv",
                toCsv([
                  ["Batch", "Member", "Amount", "Expected", "Difference", "Compliance"],
                  ...variances.map((r) => [
                    r.checkoff_batches?.batch_number,
                    r.members ? `${r.members.first_name} ${r.members.last_name}` : r.employee_name,
                    r.deduction_amount,
                    r.expected_amount,
                    r.variance_amount,
                    r.compliance_status,
                  ]),
                ]),
              )
            }
          >
            <LineTable rows={variances.slice(0, 300)} />
          </ReportCard>
        </TabsContent>

        <TabsContent value="settlement" className="pt-4">
          <ReportCard
            title="Settlement"
            onExport={() =>
              downloadCsv(
                "checkoff-settlement.csv",
                toCsv([
                  ["Batch", "Period", "Expected", "Received", "Difference", "Status"],
                  ...(settlements.data ?? []).map((s) => [
                    s.checkoff_batches?.batch_number,
                    s.checkoff_batches?.payroll_period,
                    s.expected_amount,
                    s.actual_amount,
                    s.variance,
                    s.status,
                  ]),
                ]),
              )
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(settlements.data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.checkoff_batches?.batch_number ?? "—"}</TableCell>
                    <TableCell>{s.checkoff_batches?.payroll_period ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatNaira(s.expected_amount)}</TableCell>
                    <TableCell className="text-right">{formatNaira(s.actual_amount)}</TableCell>
                    <TableCell className="text-right">{formatNaira(s.variance)}</TableCell>
                    <TableCell>{label(s.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="types" className="pt-4">
          <ReportCard
            title="By deduction type"
            onExport={() =>
              downloadCsv(
                "checkoff-by-type.csv",
                toCsv([["Type", "Rows", "Amount"], ...byType.map(([k, v]) => [k, v.count, v.amount])]),
              )
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byType.map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell>{label(k)}</TableCell>
                    <TableCell className="text-right">{formatNumber(v.count)}</TableCell>
                    <TableCell className="text-right">{formatNaira(v.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportCard({
  title,
  onExport,
  children,
}: {
  title: string;
  onExport: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="outline" size="sm" onClick={onExport}>Export</Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[32rem] overflow-auto">{children}</div>
      </CardContent>
    </Card>
  );
}

type ReportLine = {
  id: string;
  employee_name: string | null;
  member_number: string | null;
  employee_id: string | null;
  staff_number: string | null;
  deduction_type: string;
  deduction_amount: number;
  expected_amount: number | null;
  variance_amount: number | null;
  posting_status: string;
  members?: { first_name: string; last_name: string; member_number: string | null } | null;
  checkoff_batches?: { batch_number: string; payroll_period: string } | null;
};

function LineTable({ rows }: { rows: ReportLine[] }) {
  if (rows.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nothing to show for this filter.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Batch</TableHead>
          <TableHead>Member</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Expected</TableHead>
          <TableHead className="text-right">Difference</TableHead>
          <TableHead>Posting</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="text-xs">{r.checkoff_batches?.batch_number ?? "—"}</TableCell>
            <TableCell>
              {r.members ? `${r.members.first_name} ${r.members.last_name}` : (r.employee_name ?? "—")}
              <div className="text-xs text-muted-foreground">
                {r.members?.member_number ?? r.member_number ?? r.employee_id ?? r.staff_number ?? ""}
              </div>
            </TableCell>
            <TableCell>{label(r.deduction_type)}</TableCell>
            <TableCell className="text-right">{formatNaira(r.deduction_amount)}</TableCell>
            <TableCell className="text-right">{formatNaira(r.expected_amount)}</TableCell>
            <TableCell className="text-right">{formatNaira(r.variance_amount)}</TableCell>
            <TableCell className="text-xs">{label(r.posting_status)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
