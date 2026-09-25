import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

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
import { useSession } from "@/lib/session";
import { formatDate, formatNaira, formatNumber } from "@/lib/format";
import { batchStatusTone, label } from "@/lib/checkoff";
import { CalendarClock, FileUp, ShieldAlert, Users } from "lucide-react";

export const Route = createFileRoute("/admin/checkoff/")({
  head: () => ({
    meta: [
      { title: "Check-off — CoopOS Nigeria" },
      { name: "description", content: "Employer payroll deductions from upload through matching, approval and posting." },
      { property: "og:title", content: "Check-off — CoopOS Nigeria" },
      { property: "og:description", content: "Employer payroll deductions from upload through matching, approval and posting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoffDashboard,
});

function CheckoffDashboard() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const batches = useQuery({
    queryKey: ["checkoff-batches", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkoff_batches")
        .select("*")
        .eq("cooperative_id", coopId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const exceptions = useQuery({
    queryKey: ["checkoff-open-exceptions", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("checkoff_exceptions")
        .select("id", { count: "exact", head: true })
        .eq("cooperative_id", coopId!)
        .eq("resolved", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const rows = batches.data ?? [];
  const posted = rows.filter((b) => b.status === "POSTED" || b.status === "PARTIALLY_POSTED");
  const pending = rows.filter((b) =>
    ["UPLOADED", "VALIDATION_COMPLETE", "EXCEPTION_REVIEW", "READY_FOR_APPROVAL", "CHECKED", "APPROVED"].includes(
      b.status,
    ),
  );
  const gross = rows.reduce((s, b) => s + Number(b.total_gross_amount ?? 0), 0);
  const postedAmount = rows.reduce((s, b) => s + Number(b.total_posted_amount ?? 0), 0);
  const unmatched = rows.reduce((s, b) => s + Number(b.total_unmatched_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-off"
        description="Employer payroll deductions, from upload through matching and approval to posting into savings."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/checkoff/profiles">Employers</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/admin/checkoff/import">Upload a payroll file</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Batches received" value={formatNumber(rows.length)} icon={FileUp} />
        <StatCard label="Awaiting action" value={formatNumber(pending.length)} icon={CalendarClock} />
        <StatCard label="Posted to savings" value={formatNaira(postedAmount)} icon={Users} />
        <StatCard label="Open exceptions" value={formatNumber(exceptions.data ?? 0)} icon={ShieldAlert} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payroll totals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Payroll received</p>
            <p className="text-lg font-semibold">{formatNaira(gross)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Posted</p>
            <p className="text-lg font-semibold">{formatNaira(postedAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unmatched</p>
            <p className="text-lg font-semibold">{formatNaira(unmatched)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Batches</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {batches.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No payroll files yet. Set up an employer, then upload your first file.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Payroll period</TableHead>
                  <TableHead>Deduction date</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.batch_number}</TableCell>
                    <TableCell>{b.payroll_period}</TableCell>
                    <TableCell>{formatDate(b.deduction_date)}</TableCell>
                    <TableCell className="text-right">{formatNumber(b.total_records)}</TableCell>
                    <TableCell className="text-right">{formatNaira(b.total_gross_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={batchStatusTone(b.status)}>{label(b.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/admin/checkoff/$batchId" params={{ batchId: b.id }}>
                          Open
                        </Link>
                      </Button>
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
