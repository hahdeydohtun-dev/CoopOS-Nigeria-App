import { useQuery } from "@tanstack/react-query";

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
import { downloadCsv, label } from "@/lib/loans";

/** A member's own repayment history and loan statement, built from posted entries only. */
export function MemberRepayments({ memberId }: { memberId: string | null }) {
  const payments = useQuery({
    queryKey: ["portal-repayments", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("repayment_number, repayment_date, amount, allocated_amount, unapplied_amount, payment_source, status, loans(loan_number)")
        .eq("member_id", memberId!)
        .order("repayment_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const entries = useQuery({
    queryKey: ["portal-loan-statement", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_transactions")
        .select("transaction_number, transaction_date, transaction_type, amount, narration, status, loans(loan_number)")
        .eq("member_id", memberId!)
        .eq("status", "POSTED")
        .order("transaction_date")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const credits = new Set([
    "PRINCIPAL_REPAYMENT",
    "INTEREST_REPAYMENT",
    "FEE_REPAYMENT",
    "PENALTY_REPAYMENT",
    "ADJUSTMENT_CREDIT",
    "WRITE_OFF",
  ]);

  let running = 0;
  const statement = (entries.data ?? []).map((t) => {
    const amount = Number(t.amount);
    const reduces = credits.has(t.transaction_type);
    running += reduces ? -amount : amount;
    return {
      entry: t.transaction_number ?? "",
      date: t.transaction_date,
      description: t.narration ?? label(t.transaction_type),
      loan: (t.loans as { loan_number?: string } | null)?.loan_number ?? "",
      increase: reduces ? 0 : amount,
      decrease: reduces ? amount : 0,
      balance: Math.max(0, Math.round(running * 100) / 100),
    };
  });

  const paid = (payments.data ?? [])
    .filter((p) => p.status === "POSTED")
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Payments you have made · {formatNaira(paid)} in total
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={(payments.data ?? []).length === 0}
            onClick={() =>
              downloadCsv(
                "my-loan-payments.csv",
                (payments.data ?? []).map((p) => ({
                  receipt: p.repayment_number,
                  date: p.repayment_date,
                  loan: (p.loans as { loan_number?: string } | null)?.loan_number ?? "",
                  amount: p.amount,
                  source: p.payment_source,
                  status: p.status,
                })),
              )
            }
          >
            Download
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {payments.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : (payments.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">You have not made any loan payment yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>How it was paid</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payments.data ?? []).map((p) => (
                    <TableRow key={p.repayment_number}>
                      <TableCell className="font-medium">{p.repayment_number}</TableCell>
                      <TableCell>{formatDate(p.repayment_date)}</TableCell>
                      <TableCell>{(p.loans as { loan_number?: string } | null)?.loan_number ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(p.amount)}</TableCell>
                      <TableCell>{label(p.payment_source)}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "POSTED" ? "default" : "secondary"}>{label(p.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Loan statement</CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={statement.length === 0}
            onClick={() => downloadCsv("my-loan-statement.csv", statement)}
          >
            Download
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {entries.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : statement.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">There is nothing on your loan statement yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead className="text-right">Added</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.map((r, i) => (
                    <TableRow key={`${r.entry}-${i}`}>
                      <TableCell>{formatDate(r.date)}</TableCell>
                      <TableCell className="max-w-xs">{r.description}</TableCell>
                      <TableCell>{r.loan}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.increase > 0 ? formatNaira(r.increase) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.decrease > 0 ? formatNaira(r.decrease) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
