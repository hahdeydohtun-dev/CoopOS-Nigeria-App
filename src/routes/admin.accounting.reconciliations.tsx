import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, CircleMinus, CircleX, Scale, Sigma, Wallet } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { downloadCsv, friendlyAccountingError, today } from "@/lib/accounting";
import { formatDate, formatNaira } from "@/lib/format";
import {
  RECONCILIATION_TYPES,
  STATUS_LABELS,
  classifyRow,
  reconciliationCsvRows,
  resolveType,
  summarise,
  type ReconciliationStatus,
  type SubledgerRow,
} from "@/lib/reconciliation";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/accounting/reconciliations")({
  head: () => ({
    meta: [
      { title: "Accounting reconciliations — CoopOS Nigeria" },
      {
        name: "description",
        content: "Compare the operational subledgers with the General Ledger.",
      },
      { property: "og:title", content: "Accounting reconciliations — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Compare the operational subledgers with the General Ledger.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReconciliationsPage,
});

const CUSTOM_DATE = "CUSTOM";

const STATUS_STYLE: Record<
  ReconciliationStatus,
  { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  RECONCILED: { variant: "default" },
  OUT_OF_BALANCE: { variant: "destructive" },
  NO_DATA: { variant: "secondary" },
  ERROR: { variant: "outline", className: "border-destructive text-destructive" },
};

function StatusIcon({ status, className }: { status: ReconciliationStatus; className?: string }) {
  const props = { className: cn("size-3.5", className), "aria-hidden": true as const };
  if (status === "RECONCILED") return <CircleCheck {...props} />;
  if (status === "OUT_OF_BALANCE") return <CircleAlert {...props} />;
  if (status === "ERROR") return <CircleX {...props} />;
  return <CircleMinus {...props} />;
}

function StatusBadge({ status }: { status: ReconciliationStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <Badge variant={style.variant} className={cn("gap-1", style.className)}>
      <StatusIcon status={status} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function ReconciliationsPage() {
  const { cooperative, hasPermission, accessLoading } = useSession();
  const coopId = cooperative?.id ?? null;
  const coopName = cooperative?.trading_name ?? cooperative?.legal_name ?? "";
  const canView = hasPermission("accounting.view");
  const canExport = hasPermission("accounting.export");

  const [periodId, setPeriodId] = useState<string>(CUSTOM_DATE);
  const [asOf, setAsOf] = useState(today());
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [investigating, setInvestigating] = useState<SubledgerRow | null>(null);

  const periods = useQuery({
    queryKey: ["accounting-periods", coopId],
    enabled: Boolean(coopId) && canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_periods")
        .select("id, name, start_date, end_date, status")
        .eq("cooperative_id", coopId!)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // The database performs the reconciliation. The screen never recomputes a balance.
  const reconciliation = useQuery({
    queryKey: ["accounting-reconciliation", coopId, asOf],
    enabled: Boolean(coopId) && Boolean(asOf) && canView,
    retry: false,
    queryFn: async (): Promise<SubledgerRow[]> => {
      const { data, error } = await supabase.rpc("subledger_reconciliation", {
        _cooperative_id: coopId!,
        _as_of: asOf,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const allRows = useMemo(() => reconciliation.data ?? [], [reconciliation.data]);
  const rows = useMemo(
    () =>
      allRows.filter((r) => typeFilter === "ALL" || resolveType(r.subledger).key === typeFilter),
    [allRows, typeFilter],
  );
  const failed = reconciliation.isError;
  const summary = summarise(rows);
  const overallStatus: ReconciliationStatus = failed ? "ERROR" : summary.status;

  const typeOptions = useMemo(() => {
    const known = RECONCILIATION_TYPES.map((t) => ({ key: t.key, title: t.title }));
    const extra = allRows
      .map((r) => resolveType(r.subledger))
      .filter((t) => !known.some((k) => k.key === t.key))
      .map((t) => ({ key: t.key, title: t.title }));
    return [...known, ...extra];
  }, [allRows]);

  // Open exceptions for the source types behind the visible subledgers: a lead, never an explanation.
  const exceptionSourceTypes = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => resolveType(r.subledger).exceptionSourceTypes))),
    [rows],
  );
  const openExceptions = useQuery({
    queryKey: ["accounting-exception-counts", coopId, exceptionSourceTypes.join(",")],
    enabled: Boolean(coopId) && canView && exceptionSourceTypes.length > 0,
    queryFn: async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        exceptionSourceTypes.map(async (sourceType) => {
          const { count, error } = await supabase
            .from("accounting_exceptions")
            .select("id", { count: "exact", head: true })
            .eq("cooperative_id", coopId!)
            .eq("status", "OPEN")
            .eq("source_type", sourceType);
          if (error) throw error;
          counts[sourceType] = count ?? 0;
        }),
      );
      return counts;
    },
  });

  function choosePeriod(value: string) {
    setPeriodId(value);
    if (value === CUSTOM_DATE) return;
    const period = periods.data?.find((p) => p.id === value);
    if (period) setAsOf(period.end_date);
  }

  if (accessLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }
  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Accounting reconciliations" />
        <Alert>
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>You do not have permission to view accounting.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const investigatingType = investigating ? resolveType(investigating.subledger) : null;
  const investigatingStatus = investigating ? classifyRow(investigating) : null;
  const openCountForInvestigating = investigatingType
    ? investigatingType.exceptionSourceTypes.reduce(
        (sum, st) => sum + (openExceptions.data?.[st] ?? 0),
        0,
      )
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting reconciliations"
        description="Compares the operational subledgers (member savings, loans) with the General Ledger. Viewing a reconciliation never posts or changes anything."
        actions={
          canExport ? (
            <Button
              variant="outline"
              disabled={rows.length === 0}
              onClick={() =>
                downloadCsv(
                  `reconciliation-${asOf}.csv`,
                  reconciliationCsvRows(rows, { cooperative: coopName, asOf }),
                )
              }
            >
              Export
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cooperative</Label>
          <Input className="w-64" value={coopName} readOnly aria-readonly="true" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Accounting period</Label>
          <Select value={periodId} onValueChange={choosePeriod}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CUSTOM_DATE}>Custom date</SelectItem>
              {(periods.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} (to {formatDate(p.end_date)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">GL as at</Label>
          <Input
            type="date"
            value={asOf}
            onChange={(e) => {
              setPeriodId(CUSTOM_DATE);
              setAsOf(e.target.value);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Reconciliation type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {typeOptions.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {asOf && asOf !== today() && (
        <Alert>
          <AlertTitle>Subledger balances are always current</AlertTitle>
          <AlertDescription>
            Only the General Ledger side is taken as at {formatDate(asOf)}. The subledger side is
            today's balance, so a difference for an earlier date may simply be activity recorded
            since then. It is not evidence of an error on its own.
          </AlertDescription>
        </Alert>
      )}

      {failed && (
        <Alert variant="destructive">
          <AlertTitle>The reconciliation could not be run</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{friendlyAccountingError(reconciliation.error)}</p>
            <Button size="sm" variant="outline" onClick={() => void reconciliation.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total GL balance"
          icon={Wallet}
          loading={reconciliation.isPending}
          unavailable={failed}
          value={formatNaira(summary.glTotal)}
          hint="Sum of the GL side of the rows shown"
        />
        <StatCard
          label="Total subledger balance"
          icon={Sigma}
          loading={reconciliation.isPending}
          unavailable={failed}
          value={formatNaira(summary.subledgerTotal)}
          hint="Sum of the subledger side of the rows shown"
        />
        <StatCard
          label="Difference"
          icon={Scale}
          loading={reconciliation.isPending}
          unavailable={failed}
          value={formatNaira(summary.absoluteDifference)}
          hint="Sum of each row's difference, ignoring its sign"
        />
        <Card>
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              {reconciliation.isPending ? (
                <p className="text-sm text-muted-foreground">Checking…</p>
              ) : (
                <StatusBadge status={overallStatus} />
              )}
              <p className="text-xs text-muted-foreground">Worst result across the rows shown</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {reconciliation.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Comparing the ledgers…</p>
          ) : failed ? (
            <p className="p-6 text-sm text-muted-foreground">
              No result to show because the reconciliation failed.
            </p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              The database returned no reconciliation rows for this selection.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reconciliation</TableHead>
                    <TableHead>GL account basis</TableHead>
                    <TableHead className="text-right">Subledger balance</TableHead>
                    <TableHead className="text-right">GL balance</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const type = resolveType(row.subledger);
                    const status = classifyRow(row);
                    const off = status === "OUT_OF_BALANCE";
                    return (
                      <TableRow key={row.subledger} className={cn(off && "bg-destructive/5")}>
                        <TableCell className="font-medium">{type.title}</TableCell>
                        <TableCell className="max-w-xs text-sm text-muted-foreground">
                          {type.glBasis}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNaira(row.subledger_balance)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNaira(row.gl_balance)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            off && "font-semibold text-destructive",
                          )}
                        >
                          {formatNaira(row.difference)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {off && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setInvestigating(row)}
                            >
                              Investigate
                            </Button>
                          )}
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

      <Dialog
        open={investigating !== null}
        onOpenChange={(open) => !open && setInvestigating(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{investigatingType?.title}</DialogTitle>
            <DialogDescription>
              Difference of {formatNaira(investigating?.difference)} as at {formatDate(asOf)}.
            </DialogDescription>
          </DialogHeader>
          {investigating && investigatingType && investigatingStatus && (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Subledger balance</dt>
                <dd className="text-right tabular-nums">
                  {formatNaira(investigating.subledger_balance)}
                </dd>
                <dt className="text-muted-foreground">GL balance</dt>
                <dd className="text-right tabular-nums">{formatNaira(investigating.gl_balance)}</dd>
                <dt className="text-muted-foreground">Difference</dt>
                <dd className="text-right font-semibold tabular-nums text-destructive">
                  {formatNaira(investigating.difference)}
                </dd>
              </dl>

              <div className="space-y-1">
                <p className="font-medium">Unexplained difference</p>
                <p className="text-muted-foreground">
                  This screen cannot attribute the difference to a cause, so it is treated as an
                  exception to investigate. No adjustment is made here; any correction must be a
                  journal or a reversal, approved in the normal way.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-medium">Leads worth checking</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>
                    Open accounting exceptions for this subledger's events:{" "}
                    {openExceptions.isPending ? (
                      "checking…"
                    ) : openExceptions.isError ? (
                      "could not be counted."
                    ) : (
                      <span className="font-medium text-foreground">
                        {openCountForInvestigating}
                      </span>
                    )}
                    {openCountForInvestigating > 0 &&
                      " (these events are not in the ledger yet, so they can contribute to the difference)"}
                  </li>
                  <li>
                    The GL side is: {investigatingType.glBasis}. Only posted journals are counted,
                    so an account with the wrong subtype is left out.
                  </li>
                  {asOf !== today() && (
                    <li>
                      The subledger side is today's balance, not the balance at {formatDate(asOf)}.
                    </li>
                  )}
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                {investigatingType.investigate.map((link) => (
                  <Button key={link.to} asChild variant="outline" size="sm">
                    <Link to={link.to}>{link.label}</Link>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
