import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
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
import { formatNaira, formatNumber } from "@/lib/format";
import { label } from "@/lib/savings";

export const Route = createFileRoute("/admin/savings/reports")({
  head: () => ({
    meta: [
      { title: "Savings reports — CoopOS Nigeria" },
      { name: "description", content: "Savings balances by product, branch and member category, with reconciliation." },
      { property: "og:title", content: "Savings reports — CoopOS Nigeria" },
      { property: "og:description", content: "Savings balances by product, branch and member category, with reconciliation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SavingsReportsPage,
});

type Group = { key: string; accounts: number; balance: number };

function SavingsReportsPage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const data = useQuery({
    queryKey: ["savings-reports", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data: accounts, error } = await supabase
        .from("member_savings_accounts")
        .select(
          "id, current_balance, savings_products(product_name), members(branches(name), memberships(membership_categories(name), department))",
        )
        .eq("cooperative_id", coopId!);
      if (error) throw error;

      const { data: posted, error: pErr } = await supabase
        .from("savings_transactions")
        .select("amount, direction")
        .eq("cooperative_id", coopId!)
        .eq("status", "POSTED");
      if (pErr) throw pErr;

      const rows = accounts ?? [];
      const group = (fn: (row: (typeof rows)[number]) => string): Group[] => {
        const map = new Map<string, Group>();
        for (const row of rows) {
          const key = fn(row) || "Not recorded";
          const g = map.get(key) ?? { key, accounts: 0, balance: 0 };
          g.accounts += 1;
          g.balance += Number(row.current_balance ?? 0);
          map.set(key, g);
        }
        return [...map.values()].sort((a, b) => b.balance - a.balance);
      };

      const ledger = (posted ?? []).reduce(
        (s, t) => s + (t.direction === "CREDIT" ? Number(t.amount) : -Number(t.amount)),
        0,
      );
      const subledger = (accounts ?? []).reduce((s, a) => s + Number(a.current_balance ?? 0), 0);

      return {
        byProduct: group((r) => r.savings_products?.product_name ?? ""),
        byBranch: group((r) => r.members?.branches?.name ?? ""),
        byCategory: group(
          (r) => r.members?.memberships?.[0]?.membership_categories?.name ?? "",
        ),
        byDepartment: group((r) => r.members?.memberships?.[0]?.department ?? ""),
        ledger,
        subledger,
      };
    },
  });

  const exportCsv = () => {
    const d = data.data;
    if (!d) return;
    const rows = [
      ["Grouping", "Name", "Accounts", "Balance"],
      ...d.byProduct.map((g) => ["Product", g.key, String(g.accounts), String(g.balance)]),
      ...d.byBranch.map((g) => ["Branch", g.key, String(g.accounts), String(g.balance)]),
      ...d.byCategory.map((g) => ["Category", g.key, String(g.accounts), String(g.balance)]),
      ...d.byDepartment.map((g) => ["Department", g.key, String(g.accounts), String(g.balance)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "savings-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const d = data.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings reports"
        description="Balances grouped for review, all drawn from posted entries."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!d}>
            Export CSV
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reconciliation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {!d ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <>
              <p>
                Sum of posted savings entries:{" "}
                <span className="font-medium">{formatNaira(d.ledger)}</span>
              </p>
              <p>
                Sum of account balances:{" "}
                <span className="font-medium">{formatNaira(d.subledger)}</span>
              </p>
              <p
                className={
                  Math.abs(d.ledger - d.subledger) < 0.01 ? "text-muted-foreground" : "text-destructive"
                }
              >
                {Math.abs(d.ledger - d.subledger) < 0.01
                  ? "The savings records agree."
                  : `Difference of ${formatNaira(d.ledger - d.subledger)} — please investigate.`}
              </p>
              <p className="pt-2 text-muted-foreground">
                Posting into the main accounts ledger is prepared for, but no accounting entries are
                created automatically yet.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <GroupTable title="By savings product" groups={d?.byProduct} />
      <GroupTable title="By branch" groups={d?.byBranch} />
      <GroupTable title="By member category" groups={d?.byCategory} />
      <GroupTable title="By department" groups={d?.byDepartment} />
    </div>
  );
}

function GroupTable({ title, groups }: { title: string; groups: Group[] | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!groups ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No savings accounts yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Accounts</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.key}>
                  <TableCell>{g.key}</TableCell>
                  <TableCell className="text-right">{formatNumber(g.accounts)}</TableCell>
                  <TableCell className="text-right">{formatNaira(g.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
