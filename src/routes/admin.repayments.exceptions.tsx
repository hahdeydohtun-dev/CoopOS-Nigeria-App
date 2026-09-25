import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
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
import { formatDate, formatNaira } from "@/lib/format";
import { downloadCsv, friendlyLoanError, label } from "@/lib/loans";
import { postRepayment, type RepaymentSource } from "@/lib/repayments";

export const Route = createFileRoute("/admin/repayments/exceptions")({
  head: () => ({
    meta: [
      { title: "Unapplied money — CoopOS Nigeria" },
      { name: "description", content: "Payments received that could not be matched or fully applied to a loan." },
      { property: "og:title", content: "Unapplied money — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Payments received that could not be matched or fully applied to a loan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExceptionsPage,
});

function ExceptionsPage() {
  const { cooperative, user, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const queryClient = useQueryClient();

  const unapplied = useQuery({
    queryKey: ["unapplied-payments", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unapplied_loan_payments")
        .select("*, loans(loan_number, status), members(first_name, last_name, member_number)")
        .eq("cooperative_id", coopId!)
        .eq("status", "OPEN")
        .order("received_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const variances = useQuery({
    queryKey: ["repayment-variances", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("*, loans(loan_number), members(first_name, last_name, member_number)")
        .eq("cooperative_id", coopId!)
        .neq("variance_amount", 0)
        .order("repayment_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const applyNow = useMutation({
    mutationFn: async (row: {
      id: string;
      loan_id: string | null;
      member_id: string | null;
      amount: number;
      payment_source: string;
      reference: string | null;
    }) => {
      if (!row.loan_id) throw new Error("This money is not linked to a loan yet.");
      const result = await postRepayment({
        coopId: coopId!,
        loanId: row.loan_id,
        memberId: row.member_id,
        amount: Number(row.amount),
        repaymentDate: new Date().toISOString().slice(0, 10),
        source: row.payment_source as RepaymentSource,
        externalReference: row.reference,
        notes: "Applied from money previously held unapplied.",
        userId: user?.id ?? null,
      });
      const { error } = await supabase
        .from("unapplied_loan_payments")
        .update({
          status: "CANCELLED",
          resolution: `Applied as ${result.repaymentNumber}.`,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id ?? null,
        })
        .eq("id", row.id);
      if (error) throw error;
      return result.repaymentNumber;
    },
    onSuccess: (n) => {
      toast.success(`Applied as ${n}.`);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const writeBack = useMutation({
    mutationFn: async (args: { id: string; resolution: string }) => {
      const { error } = await supabase
        .from("unapplied_loan_payments")
        .update({
          status: "CANCELLED",
          resolution: args.resolution,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id ?? null,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as resolved.");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const held = (unapplied.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const canPost = hasPermission("repayments.post") || hasPermission("repayments.create");

  const name = (m: unknown) => {
    const v = m as { first_name?: string; last_name?: string } | null;
    return [v?.first_name, v?.last_name].filter(Boolean).join(" ") || "—";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unapplied money"
        description="Money received that the system would not guess at. Nothing here has been applied to a loan."
        actions={
          <Button
            variant="outline"
            disabled={(unapplied.data ?? []).length === 0}
            onClick={() =>
              downloadCsv(
                "unapplied-money.csv",
                (unapplied.data ?? []).map((r) => ({
                  member: name(r.members),
                  loan: (r.loans as { loan_number?: string } | null)?.loan_number ?? "",
                  amount: r.amount,
                  received: r.received_date,
                  source: r.payment_source,
                  reason: r.reason ?? "",
                })),
              )
            }
          >
            Export
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Held and unapplied · {formatNaira(held)} across {(unapplied.data ?? []).length} payment(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {unapplied.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : (unapplied.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nothing is being held.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Why</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(unapplied.data ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {name(r.members)}
                        <span className="block text-xs text-muted-foreground">
                          {(r.members as { member_number?: string } | null)?.member_number ?? ""}
                        </span>
                      </TableCell>
                      <TableCell>{(r.loans as { loan_number?: string } | null)?.loan_number ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(r.amount)}</TableCell>
                      <TableCell>{formatDate(r.received_date)}</TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">{r.reason ?? "—"}</TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!canPost || applyNow.isPending}
                          onClick={() => applyNow.mutate(r)}
                        >
                          Apply to loan
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!canPost}
                          onClick={() => {
                            const reason = window.prompt("How was this money dealt with?");
                            if (reason && reason.trim()) writeBack.mutate({ id: r.id, resolution: reason.trim() });
                          }}
                        >
                          Mark resolved
                        </Button>
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
        <CardHeader>
          <CardTitle className="text-base">Payments that differed from what was expected</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {variances.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : (variances.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Every payment matched what was expected.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(variances.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.repayment_number}</TableCell>
                    <TableCell>{name(r.members)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.expected_amount === null ? "—" : formatNaira(r.expected_amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(r.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNaira(Number(r.variance_amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={Number(r.variance_amount) < 0 ? "destructive" : "secondary"}>
                        {Number(r.variance_amount) < 0 ? "Short" : "Over"} · {label(r.status)}
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
