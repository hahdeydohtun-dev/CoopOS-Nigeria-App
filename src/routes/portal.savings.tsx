import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

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
import { accountStatusTone, label } from "@/lib/savings";

export const Route = createFileRoute("/portal/savings")({
  head: () => ({
    meta: [
      { title: "My savings — CoopOS Nigeria" },
      { name: "description", content: "Your savings balances, contributions and statements." },
      { property: "og:title", content: "My savings — CoopOS Nigeria" },
      { property: "og:description", content: "Your savings balances, contributions and statements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalSavingsPage,
});

function PortalSavingsPage() {
  const { user } = useSession();

  const me = useQuery({
    queryKey: ["my-member-id", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name, member_number")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const memberId = me.data?.id ?? null;

  const accounts = useQuery({
    queryKey: ["my-savings-accounts", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_savings_accounts")
        .select(
          "id, account_number, status, current_balance, locked_balance, available_balance, accrued_bonus, accrued_interest, savings_products(product_name, product_type)",
        )
        .eq("member_id", memberId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const transactions = useQuery({
    queryKey: ["my-savings-transactions", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_transactions")
        .select(
          "id, transaction_number, transaction_date, amount, direction, transaction_type, status, savings_products(product_name)",
        )
        .eq("member_id", memberId!)
        .order("transaction_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = accounts.data ?? [];
  const byType = (t: string) =>
    rows
      .filter((r) => r.savings_products?.product_type === t)
      .reduce((s, r) => s + Number(r.current_balance ?? 0), 0);

  const total = rows.reduce((s, r) => s + Number(r.current_balance ?? 0), 0);
  const locked = rows.reduce((s, r) => s + Number(r.locked_balance ?? 0), 0);
  const bonus = rows.reduce((s, r) => s + Number(r.accrued_bonus ?? 0), 0);
  const interest = rows.reduce((s, r) => s + Number(r.accrued_interest ?? 0), 0);
  const pending = (transactions.data ?? [])
    .filter((t) => t.status !== "POSTED" && t.status !== "REVERSED" && t.direction === "CREDIT")
    .reduce((s, t) => s + Number(t.amount ?? 0), 0);

  const downloadStatement = () => {
    const lines = [
      ["Entry", "Date", "Product", "Type", "Direction", "Amount", "Status"],
      ...(transactions.data ?? []).map((t) => [
        t.transaction_number,
        t.transaction_date,
        t.savings_products?.product_name ?? "",
        t.transaction_type,
        t.direction,
        String(t.amount),
        t.status,
      ]),
    ];
    const csv = lines.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-savings-statement.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (me.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!me.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="My savings" description="Your savings balances and contributions." />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Your account is not linked to a membership record yet, so there is nothing to show.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My savings"
        description="Every figure comes from entries your cooperative has posted."
        actions={
          (transactions.data ?? []).length > 0 ? (
            <Button variant="outline" onClick={downloadStatement}>
              Download statement
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Amount title="Ordinary savings" value={byType("ORDINARY")} />
        <Amount title="Special savings" value={byType("SPECIAL")} />
        <Amount title="Other savings" value={total - byType("ORDINARY") - byType("SPECIAL")} />
        <Amount title="Total savings" value={total} />
        <Amount title="Available" value={total - locked} />
        <Amount title="Locked" value={locked} />
        <Amount title="Pending contributions" value={pending} hint="Not yet posted" />
        <Amount title="Bonus and interest accrued" value={bonus + interest} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My savings accounts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              You do not have a savings account yet. Your cooperative opens one when your first
              contribution is recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.account_number}</TableCell>
                    <TableCell>{a.savings_products?.product_name}</TableCell>
                    <TableCell className="text-right">{formatNaira(a.current_balance)}</TableCell>
                    <TableCell className="text-right">{formatNaira(a.available_balance)}</TableCell>
                    <TableCell>
                      <Badge variant={accountStatusTone(a.status)}>{label(a.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(transactions.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No activity.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(transactions.data ?? []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.transaction_date)}</TableCell>
                      <TableCell>{t.transaction_number}</TableCell>
                      <TableCell>{t.savings_products?.product_name}</TableCell>
                      <TableCell>{label(t.transaction_type)}</TableCell>
                      <TableCell className="text-right">
                        {t.direction === "DEBIT" ? "−" : ""}
                        {formatNaira(t.amount)}
                      </TableCell>
                      <TableCell>{label(t.status)}</TableCell>
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

function Amount({ title, value, hint }: { title: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-1 text-lg font-semibold">{formatNaira(value)}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
