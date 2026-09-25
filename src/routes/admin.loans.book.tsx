import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { downloadCsv, label } from "@/lib/loans";

export const Route = createFileRoute("/admin/loans/book")({
  head: () => ({
    meta: [
      { title: "Loan book — CoopOS Nigeria" },
      { name: "description", content: "Live loan accounts and their posted entries." },
      { property: "og:title", content: "Loan book — CoopOS Nigeria" },
      { property: "og:description", content: "Live loan accounts and their posted entries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoanBookPage,
});

function LoanBookPage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const loans = useQuery({
    queryKey: ["loan-book", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("*, members(first_name, last_name, member_number), loan_products(product_name)")
        .eq("cooperative_id", coopId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const transactions = useQuery({
    queryKey: ["loan-transactions", selected],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_transactions")
        .select("*")
        .eq("loan_id", selected!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const term = search.trim().toLowerCase();
  const rows = (loans.data ?? []).filter((l) => {
    if (!term) return true;
    const m = l.members as { first_name?: string; last_name?: string; member_number?: string } | null;
    return [l.loan_number, m?.first_name, m?.last_name, m?.member_number]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(term));
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan book"
        description="Balances are calculated from posted loan entries and cannot be typed in."
        actions={
          <Button
            variant="outline"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                "loan-book.csv",
                rows.map((l) => {
                  const m = l.members as { first_name?: string; last_name?: string; member_number?: string } | null;
                  return {
                    loan: l.loan_number,
                    member: [m?.first_name, m?.last_name].filter(Boolean).join(" "),
                    member_number: m?.member_number ?? "",
                    principal: l.principal_amount,
                    disbursed: l.disbursed_amount,
                    outstanding: l.total_outstanding,
                    status: l.status,
                    start: l.start_date ?? "",
                    maturity: l.maturity_date ?? "",
                  };
                }),
              )
            }
          >
            Export
          </Button>
        }
      />

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by loan or member"
        className="max-w-xs"
      />

      <Card>
        <CardContent className="p-0">
          {loans.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading loans…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No loan has been disbursed yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Disbursed</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Maturity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((l) => {
                    const m = l.members as { first_name?: string; last_name?: string; member_number?: string } | null;
                    const p = l.loan_products as { product_name?: string } | null;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.loan_number}</TableCell>
                        <TableCell>
                          {[m?.first_name, m?.last_name].filter(Boolean).join(" ")}
                          <span className="block text-xs text-muted-foreground">{m?.member_number ?? ""}</span>
                        </TableCell>
                        <TableCell>{p?.product_name ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNaira(l.disbursed_amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNaira(l.total_outstanding)}</TableCell>
                        <TableCell>{l.maturity_date ? formatDate(l.maturity_date) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={l.status === "ACTIVE" ? "default" : "secondary"}>{label(l.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(l.id)}>
                            Entries
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Loan entries</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {transactions.isPending ? (
              <p className="p-6 text-sm text-muted-foreground">Loading entries…</p>
            ) : (transactions.data ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No entry on this loan yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Fees</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(transactions.data ?? []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.transaction_date)}</TableCell>
                      <TableCell>{label(t.transaction_type)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(t.amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(t.principal_component)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(t.interest_component)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(t.fee_component)}</TableCell>
                      <TableCell><Badge variant="outline">{label(t.status)}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
