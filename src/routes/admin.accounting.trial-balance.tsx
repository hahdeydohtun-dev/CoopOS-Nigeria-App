import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useSession } from "@/lib/session";
import { formatNaira } from "@/lib/format";
import { downloadCsv, loadTrialBalance, startOfYear, today } from "@/lib/accounting";

export const Route = createFileRoute("/admin/accounting/trial-balance")({
  head: () => ({
    meta: [
      { title: "Trial balance — CoopOS Nigeria" },
      { name: "description", content: "Debits and credits per account for any date range." },
      { property: "og:title", content: "Trial balance — CoopOS Nigeria" },
      { property: "og:description", content: "Debits and credits per account for any date range." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrialBalancePage,
});

function TrialBalancePage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(today());

  const rows = useQuery({
    queryKey: ["trial-balance", coopId, from, to],
    enabled: Boolean(coopId),
    queryFn: () => loadTrialBalance(coopId!, from, to),
  });

  const data = rows.data ?? [];
  const totalDebit = data.reduce((s, r) => s + Number(r.debit), 0);
  const totalCredit = data.reduce((s, r) => s + Number(r.credit), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trial balance"
        description="Built only from posted journals. Totals must agree — if they do not, the ledger will say so."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                `trial-balance-${from}-to-${to}.csv`,
                data.map((r) => ({
                  code: r.code,
                  account: r.name,
                  type: r.account_type,
                  opening: r.opening,
                  debit: r.debit,
                  credit: r.credit,
                  closing: r.net,
                })),
              )
            }
          >
            Export
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Working out the balances…</p>
          ) : data.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nothing has been posted in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.account_id}>
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{formatNaira(r.opening)}</TableCell>
                      <TableCell className="text-right">{formatNaira(r.debit)}</TableCell>
                      <TableCell className="text-right">{formatNaira(r.credit)}</TableCell>
                      <TableCell className="text-right">{formatNaira(r.net)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatNaira(totalDebit)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatNaira(totalCredit)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {Math.abs(totalDebit - totalCredit) < 0.005 ? "Balanced" : "Out of balance"}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
