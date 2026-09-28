import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { ACCOUNTING_EVENTS, friendlyAccountingError, label as human } from "@/lib/accounting";
import {
  KNOWN_SOURCE_TYPES,
  RETRY_OUTCOME_TEXT,
  SOURCE_TYPE_LABELS,
  classifyRetry,
  detailEntries,
  isRetryable,
  memberIdFromDetails,
  sourceLink,
  type ExceptionStatus,
  type RetryOutcome,
} from "@/lib/accounting-exceptions";
import { formatDateTime, formatNaira } from "@/lib/format";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin/accounting/exceptions")({
  head: () => ({
    meta: [
      { title: "Accounting exceptions — CoopOS Nigeria" },
      {
        name: "description",
        content: "Events the accounting engine could not post, and a way to retry them.",
      },
      { property: "og:title", content: "Accounting exceptions — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Events the accounting engine could not post, and a way to retry them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExceptionsPage,
});

const ROW_LIMIT = 500;

type StatusFilter = ExceptionStatus | "ALL";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "OPEN", label: "Unresolved" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "IGNORED", label: "Ignored" },
  { value: "ALL", label: "All statuses" },
];

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "OPEN") return "destructive";
  if (status === "RESOLVED") return "default";
  return "secondary";
}

function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "—";
}

type RetryRecord = { outcome: RetryOutcome; message?: string; at: string };

function ExceptionsPage() {
  const { cooperative, hasPermission, accessLoading } = useSession();
  const qc = useQueryClient();
  const coopId = cooperative?.id ?? null;
  const coopName = cooperative?.trading_name ?? cooperative?.legal_name ?? "";
  const canView = hasPermission("accounting.view");
  // retry_accounting_exception() enforces accounting.post; the button mirrors it.
  const canRetry = hasPermission("accounting.post");

  const [status, setStatus] = useState<StatusFilter>("OPEN");
  const [sourceType, setSourceType] = useState("ALL");
  const [eventCode, setEventCode] = useState("ALL");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  // Retries are not recorded by the engine, so this is what happened in this browser session only.
  const [retryLog, setRetryLog] = useState<Record<string, RetryRecord>>({});

  const list = useQuery({
    queryKey: ["accounting-exceptions", coopId, status, sourceType, eventCode, from, to],
    enabled: Boolean(coopId) && canView,
    queryFn: async () => {
      // The cooperative filter is explicit as well as enforced by row-level security.
      let q = supabase
        .from("accounting_exceptions")
        .select("*")
        .eq("cooperative_id", coopId!)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (status !== "ALL") q = q.eq("status", status);
      if (sourceType !== "ALL") q = q.eq("source_type", sourceType);
      if (eventCode !== "ALL") q = q.eq("event_code", eventCode);
      if (from) q = q.gte("created_at", new Date(`${from}T00:00:00`).toISOString());
      if (to) q = q.lte("created_at", new Date(`${to}T23:59:59.999`).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const detail = useQuery({
    queryKey: ["accounting-exception", coopId, selectedId],
    enabled: Boolean(coopId) && Boolean(selectedId) && canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_exceptions")
        .select("*")
        .eq("cooperative_id", coopId!)
        .eq("id", selectedId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const retry = useMutation({
    mutationFn: async (id: string) => {
      setRetryingId(id);
      // The database does all of the work: it re-attempts the posting through the existing engine.
      const { data, error } = await supabase.rpc("retry_accounting_exception", {
        _exception_id: id,
      });
      if (error) throw error;
      const journalId = (data as string | null) ?? null;

      const { data: fresh, error: rereadError } = await supabase
        .from("accounting_exceptions")
        .select("status")
        .eq("id", id)
        .maybeSingle();
      const refreshedStatus = rereadError ? undefined : (fresh?.status ?? undefined);

      return { id, journalId, refreshedStatus };
    },
    onSuccess: ({ id, journalId, refreshedStatus }) => {
      const outcome = classifyRetry({ error: false, journalId, refreshedStatus });
      setRetryLog((prev) => ({ ...prev, [id]: { outcome, at: new Date().toISOString() } }));
      if (outcome === "RESOLVED") toast.success(RETRY_OUTCOME_TEXT[outcome]);
      else toast.warning(RETRY_OUTCOME_TEXT[outcome]);
    },
    onError: (e, id) => {
      const message = friendlyAccountingError(e);
      setRetryLog((prev) => ({
        ...prev,
        [id]: { outcome: "FAILED", message, at: new Date().toISOString() },
      }));
      toast.error(message);
    },
    onSettled: () => {
      setRetryingId(null);
      // A retry can add a journal, so everything built from the ledger is refreshed.
      for (const key of [
        "accounting-exceptions",
        "accounting-exception",
        "accounting-exception-counts",
        "accounting-reconciliation",
        "accounting-dashboard",
        "accounting-dashboard-counts",
        "journals",
        "trial-balance",
        "general-ledger",
      ]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  if (accessLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }
  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Accounting exceptions" />
        <Alert>
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>You do not have permission to view accounting.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const needle = search.trim().toLowerCase();
  const rows = (list.data ?? [])
    .filter(
      (r) =>
        !needle ||
        r.reason.toLowerCase().includes(needle) ||
        r.id.toLowerCase().includes(needle) ||
        (r.source_id ?? "").toLowerCase().includes(needle),
    )
    // Unresolved first; within each group the query's newest-first order is kept.
    .sort((a, b) => Number(b.status === "OPEN") - Number(a.status === "OPEN"));

  const selected = detail.data ?? null;
  const selectedLink = selected ? sourceLink(selected.source_type, selected.source_id) : null;
  const selectedMemberId = selected ? memberIdFromDetails(selected.details) : null;
  const selectedRetry = selectedId ? retryLog[selectedId] : undefined;

  function retryButton(id: string, sourceTypeValue: string | null, statusValue: string) {
    if (statusValue !== "OPEN" || !canRetry || !isRetryable(sourceTypeValue)) return null;
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={retryingId !== null}
        onClick={() => setConfirmId(id)}
      >
        {retryingId === id ? "Retrying…" : "Retry"}
      </Button>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting exceptions"
        description={`Events the accounting engine could not post for ${coopName || "this cooperative"}: a missing mapping, no accounting period, or a closed one. Fix the cause, then retry. Exceptions are never deleted.`}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Source type</Label>
          <Select value={sourceType} onValueChange={setSourceType}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All source types</SelectItem>
              {KNOWN_SOURCE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {SOURCE_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Event type</Label>
          <Select value={eventCode} onValueChange={setEventCode}>
            <SelectTrigger className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All events</SelectItem>
              {ACCOUNTING_EVENTS.map((e) => (
                <SelectItem key={e} value={e}>
                  {human(e)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Raised from</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Raised to</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Search message or ID</Label>
          <Input
            className="w-56"
            placeholder="e.g. closed, mapping, ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        The engine does not store an error code or a retry count, so there is nothing to filter or
        show for those. The message search covers what it does record.
      </p>

      {list.isError && (
        <Alert variant="destructive">
          <AlertTitle>The exceptions could not be loaded</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{friendlyAccountingError(list.error)}</p>
            <Button size="sm" variant="outline" onClick={() => void list.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {list.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading exceptions…</p>
          ) : list.isError ? (
            <p className="p-6 text-sm text-muted-foreground">Nothing to show.</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {status === "OPEN"
                ? "No unresolved exceptions. Everything the engine tried to post is in the ledger."
                : "No exceptions match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Raised</TableHead>
                    <TableHead>Resolved</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs" title={r.id}>
                        {shortId(r.id)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{SOURCE_TYPE_LABELS[r.source_type ?? ""] ?? human(r.source_type)}</div>
                        <div
                          className="font-mono text-xs text-muted-foreground"
                          title={r.source_id ?? ""}
                        >
                          {shortId(r.source_id)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{human(r.event_code)}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm" title={r.reason}>
                        {r.reason}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)}>{human(r.status)}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(r.created_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(r.resolved_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedId(r.id)}>
                            Details
                          </Button>
                          {retryButton(r.id, r.source_type, r.status)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {(list.data?.length ?? 0) >= ROW_LIMIT && (
        <p className="text-xs text-muted-foreground">
          Showing the newest {ROW_LIMIT} exceptions. Narrow the filters to see older ones.
        </p>
      )}

      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Exception {shortId(selectedId)}</DialogTitle>
            <DialogDescription>
              {selected ? human(selected.event_code) : "Loading the exception…"}
            </DialogDescription>
          </DialogHeader>

          {detail.isPending && selectedId ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : detail.isError ? (
            <p className="text-sm text-destructive">{friendlyAccountingError(detail.error)}</p>
          ) : !selected ? (
            <p className="text-sm text-muted-foreground">
              This exception could not be found. It may belong to another cooperative.
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <p className="font-medium">Error message</p>
                <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{selected.reason}</p>
              </div>

              <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={statusVariant(selected.status)}>{human(selected.status)}</Badge>
                </dd>
                <dt className="text-muted-foreground">Cooperative</dt>
                <dd>{coopName}</dd>
                <dt className="text-muted-foreground">Accounting event</dt>
                <dd>{human(selected.event_code)}</dd>
                <dt className="text-muted-foreground">Source type</dt>
                <dd>
                  {SOURCE_TYPE_LABELS[selected.source_type ?? ""] ?? human(selected.source_type)}
                </dd>
                <dt className="text-muted-foreground">Source ID</dt>
                <dd className="break-all font-mono text-xs">{selected.source_id ?? "—"}</dd>
                <dt className="text-muted-foreground">Amount</dt>
                <dd>{selected.amount === null ? "—" : formatNaira(selected.amount)}</dd>
                <dt className="text-muted-foreground">Raised</dt>
                <dd>{formatDateTime(selected.created_at)}</dd>
                <dt className="text-muted-foreground">Resolved</dt>
                <dd>{formatDateTime(selected.resolved_at)}</dd>
                {selected.resolution_note && (
                  <>
                    <dt className="text-muted-foreground">Resolution note</dt>
                    <dd>{selected.resolution_note}</dd>
                  </>
                )}
                {selected.journal_id && (
                  <>
                    <dt className="text-muted-foreground">Posted journal</dt>
                    <dd className="space-y-1">
                      <div className="break-all font-mono text-xs">{selected.journal_id}</div>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/accounting/journals">Open journals</Link>
                      </Button>
                    </dd>
                  </>
                )}
                {detailEntries(selected.details).map((d) => (
                  <div key={d.key} className="contents">
                    <dt className="text-muted-foreground">{human(d.key)}</dt>
                    <dd className="break-all">{d.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="space-y-1">
                <p className="font-medium">Originating record</p>
                {selectedLink === null && selectedMemberId === null ? (
                  <p className="text-muted-foreground">
                    No page can be linked for this source type.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedLink?.kind === "withdrawal" && (
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/admin/withdrawals/$withdrawalId"
                          params={{ withdrawalId: selectedLink.withdrawalId }}
                        >
                          Open the withdrawal request
                        </Link>
                      </Button>
                    )}
                    {selectedLink?.kind === "list" && (
                      <div className="space-y-1">
                        <Button asChild size="sm" variant="outline">
                          <Link to={selectedLink.to}>{selectedLink.label}</Link>
                        </Button>
                        <p className="text-xs text-muted-foreground">{selectedLink.note}</p>
                      </div>
                    )}
                    {selectedMemberId && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/members/$memberId" params={{ memberId: selectedMemberId }}>
                          Open the member
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="font-medium">Retry history</p>
                <p className="text-muted-foreground">
                  The accounting engine does not record retries, so no history is available. The
                  result below is only what happened in this browser session.
                </p>
                {selectedRetry ? (
                  <Alert variant={selectedRetry.outcome === "RESOLVED" ? "default" : "destructive"}>
                    <AlertDescription>
                      {selectedRetry.message ?? RETRY_OUTCOME_TEXT[selectedRetry.outcome]}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <p className="text-muted-foreground">No retry has been made in this session.</p>
                )}
              </div>

              {selected.status === "OPEN" && !isRetryable(selected.source_type) && (
                <p className="text-muted-foreground">
                  This kind of exception cannot be retried here. It has to be resolved in the module
                  that raised it.
                </p>
              )}
              {selected.status === "OPEN" && isRetryable(selected.source_type) && !canRetry && (
                <p className="text-muted-foreground">
                  Retrying posts to the ledger, so it needs the accounting.post permission.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            {selected && retryButton(selected.id, selected.source_type, selected.status)}
            <Button variant="ghost" onClick={() => setSelectedId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmId !== null} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry this posting?</AlertDialogTitle>
            <AlertDialogDescription>
              The accounting engine will try once to post this event to the ledger using the current
              mappings and accounting periods. It will not retry again on its own.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmId) retry.mutate(confirmId);
                setConfirmId(null);
              }}
            >
              Retry once
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
