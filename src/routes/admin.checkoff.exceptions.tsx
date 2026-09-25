import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

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
import { formatDateTime } from "@/lib/format";
import { downloadCsv, label, toCsv } from "@/lib/checkoff";

export const Route = createFileRoute("/admin/checkoff/exceptions")({
  head: () => ({
    meta: [
      { title: "Check-off exceptions — CoopOS Nigeria" },
      { name: "description", content: "Every unresolved payroll deduction exception, ranked by severity." },
      { property: "og:title", content: "Check-off exceptions — CoopOS Nigeria" },
      { property: "og:description", content: "Every unresolved payroll deduction exception, ranked by severity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoffExceptionsPage,
});

const SEVERITIES = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];

function CheckoffExceptionsPage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;
  const [severity, setSeverity] = useState("ALL");
  const [showResolved, setShowResolved] = useState("OPEN");

  const exceptions = useQuery({
    queryKey: ["checkoff-exceptions", coopId, severity, showResolved],
    enabled: Boolean(coopId),
    queryFn: async () => {
      let q = supabase
        .from("checkoff_exceptions")
        .select("*, checkoff_batches(batch_number, payroll_period)")
        .eq("cooperative_id", coopId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (severity !== "ALL") q = q.eq("severity", severity as never);
      if (showResolved === "OPEN") q = q.eq("resolved", false);
      if (showResolved === "RESOLVED") q = q.eq("resolved", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = exceptions.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exception centre"
        description="Everything that needs a human decision before deductions can be posted."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                "checkoff-exceptions.csv",
                toCsv([
                  ["Raised", "Batch", "Payroll period", "Severity", "Type", "What happened", "Resolved", "Resolution"],
                  ...rows.map((r) => [
                    r.created_at,
                    r.checkoff_batches?.batch_number,
                    r.checkoff_batches?.payroll_period,
                    r.severity,
                    r.exception_type,
                    r.message,
                    r.resolved ? "Yes" : "No",
                    r.resolution,
                  ]),
                ]),
              )
            }
          >
            Export
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>{s === "ALL" ? "All severities" : label(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={showResolved} onValueChange={setShowResolved}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN">Still open</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="ALL">Everything</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nothing to deal with here.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Raised</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>What happened</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</TableCell>
                    <TableCell className="text-xs">
                      {r.checkoff_batches?.batch_number ?? "—"}
                      <div className="text-muted-foreground">{r.checkoff_batches?.payroll_period ?? ""}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.severity === "CRITICAL" || r.severity === "HIGH" ? "destructive" : "secondary"}>
                        {label(r.severity)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{r.message}</div>
                      {r.suggested_action && (
                        <div className="text-xs text-muted-foreground">{r.suggested_action}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/admin/checkoff/$batchId" params={{ batchId: r.batch_id }}>Open batch</Link>
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
