import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, RefreshCw, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { downloadCsv, startOfYear, today, type AccountType } from "@/lib/accounting";
import { formatDate, formatNaira } from "@/lib/format";

export const Route = createFileRoute("/admin/accounting/general-ledger")({
  head: () => ({
    meta: [
      { title: "General ledger — CoopOS Nigeria" },
      {
        name: "description",
        content: "Detailed posted transactions and running balances for each general ledger account.",
      },
      { property: "og:title", content: "General ledger — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Detailed posted transactions and running balances for each general ledger account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GeneralLedgerPage,
});

type Account = {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  account_subtype: string | null;
  normal_balance: "DEBIT" | "CREDIT";
  is_active: boolean;
};

type LedgerRow = {
  line_id: string;
  journal_id: string;
  journal_number: string | null;
  posting_date: string;
  description: string | null;
  reference: string | null;
  source_type: string | null;
  source_id: string | null;
  member_id: string | null;
  loan_id: string | null;
  debit: number;
  credit: number;
  running_balance: number;
};

function signedLabel(value: number): string {
  if (Math.abs(value) < 0.005) return "Balanced";
  return value > 0 ? "Debit" : "Credit";
}

function signedAmount(value: number): string {
  return formatNaira(Math.abs(value));
}

function GeneralLedgerPage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState("");

  const accounts = useQuery({
    queryKey: ["general-ledger-accounts", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type, account_subtype, normal_balance, is_active")
        .eq("cooperative_id", coopId!)
        .order("code");
      if (error) throw error;
      return (data ?? []) as unknown as Account[];
    },
  });

  const ledger = useQuery({
    queryKey: ["general-ledger", coopId, accountId, from, to],
    enabled: Boolean(coopId && accountId && from && to && from <= to),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("account_ledger", {
        _cooperative_id: coopId!,
        _account_id: accountId,
        _from: from,
        _to: to,
        _limit: 500,
      });
      if (error) throw error;
      return (data ?? []) as unknown as LedgerRow[];
    },
  });

  const selectedAccount = useMemo(
    () => (accounts.data ?? []).find((account) => account.id === accountId) ?? null,
    [accounts.data, accountId],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return ledger.data ?? [];
    return (ledger.data ?? []).filter((row) =>
      [row.journal_number, row.description, row.reference, row.source_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [ledger.data, search]);

  const opening = ledger.data?.[0]
    ? Number(ledger.data[0].running_balance) -
      Number(ledger.data[0].debit) +
      Number(ledger.data[0].credit)
    : 0;
  const totalDebit = rows.reduce((sum, row) => sum + Number(row.debit), 0);
  const totalCredit = rows.reduce((sum, row) => sum + Number(row.credit), 0);
  const closing = ledger.data?.length
    ? Number(ledger.data[ledger.data.length - 1].running_balance)
    : opening;
  const naturalOpening = selectedAccount?.normal_balance === "CREDIT" ? -opening : opening;
  const naturalClosing = selectedAccount?.normal_balance === "CREDIT" ? -closing : closing;

  const exportLedger = () => {
    if (!selectedAccount || rows.length === 0) return;
    downloadCsv(
      `general-ledger-${selectedAccount.code}-${from}-to-${to}.csv`,
      rows.map((row) => ({
        date: row.posting_date,
        journal_number: row.journal_number,
        description: row.description,
        reference: row.reference,
        debit: row.debit,
        credit: row.credit,
        running_balance: row.running_balance,
        source_type: row.source_type,
        source_id: row.source_id,
      })),
    );
  };

  const clearFilters = () => {
    setAccountId("");
    setFrom(startOfYear());
    setTo(today());
    setSearch("");
  };

  const invalidDates = from > to;

  return (
    <div className="space-y-6">
      <PageHeader
        title="General ledger"
        description="Detailed posted activity for a single account, with opening balance, debits, credits and running balance."
        actions={
          <Button variant="outline" onClick={exportLedger} disabled={!selectedAccount || rows.length === 0}>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(260px,1.7fr)_repeat(2,minmax(150px,0.8fr))_minmax(180px,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <Label>Ledger account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {(accounts.data ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <span className="font-mono text-xs text-muted-foreground">{account.code}</span>{" "}
                    {account.name}
                    {!account.is_active ? " (Inactive)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Search entries</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Journal, reference or description"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <Button variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        </CardContent>
      </Card>

      {invalidDates && (
        <Card>
          <CardContent className="p-5 text-sm text-destructive">The start date cannot be after the end date.</CardContent>
        </Card>
      )}

      {!accountId && !invalidDates && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
              <FileText className="size-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="font-medium">Select an account to view its ledger</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Only posted journal lines are shown. Draft, rejected and cancelled journals never enter the ledger.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {accountId && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Opening balance</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatNaira(naturalOpening)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Before {formatDate(from)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total debits</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatNaira(totalDebit)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{rows.length} visible entries</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total credits</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatNaira(totalCredit)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Posted activity only</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Closing balance</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatNaira(naturalClosing)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{selectedAccount ? signedLabel(naturalClosing) : "—"}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">
                  {selectedAccount?.code} — {selectedAccount?.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedAccount?.account_type} · {selectedAccount?.account_subtype ?? "No subtype"} · Natural balance: {selectedAccount?.normal_balance}
                </p>
              </div>
              {ledger.isFetching && <RefreshCw className="size-4 animate-spin text-muted-foreground" />}
            </CardHeader>
            <CardContent className="p-0">
              {ledger.isPending ? (
                <p className="p-6 text-sm text-muted-foreground">Loading posted ledger entries…</p>
              ) : ledger.isError ? (
                <p className="p-6 text-sm text-destructive">Unable to load the ledger. Check the account and date range, then try again.</p>
              ) : rows.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No posted activity matches this account and filter.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Journal</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Running balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const balance = Number(row.running_balance);
                        const natural = selectedAccount?.normal_balance === "CREDIT" ? -balance : balance;
                        return (
                          <TableRow key={row.line_id}>
                            <TableCell className="whitespace-nowrap">{formatDate(row.posting_date)}</TableCell>
                            <TableCell className="font-mono text-xs">{row.journal_number ?? "—"}</TableCell>
                            <TableCell className="min-w-[240px]">{row.description ?? "—"}</TableCell>
                            <TableCell className="max-w-[180px] truncate text-muted-foreground">{row.reference ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{Number(row.debit) ? formatNaira(row.debit) : "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{Number(row.credit) ? formatNaira(row.credit) : "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              <div className="font-medium">{formatNaira(Math.abs(natural))}</div>
                              <div className="text-xs text-muted-foreground">{signedLabel(natural)}</div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow>
                        <TableCell colSpan={4} className="font-semibold">Period totals</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatNaira(totalDebit)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatNaira(totalCredit)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatNaira(naturalClosing)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {(ledger.data?.length ?? 0) >= 500 && (
            <p className="text-xs text-muted-foreground">
              The ledger view is showing the first 500 posted lines for this period. Narrow the date range or search for a specific period if more entries are expected.
            </p>
          )}
        </>
      )}
    </div>
  );
}
