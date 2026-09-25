import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDate, formatNaira } from "@/lib/format";
import { downloadCsv, friendlyLoanError, label } from "@/lib/loans";
import {
  COLLECTION_ACTION_TYPES,
  COLLECTION_CASE_STATUSES,
  COLLECTION_PRIORITIES,
  priorityTone,
  type CollectionActionType,
  type CollectionCaseStatus,
  type CollectionPriority,
  type PromiseStatus,
} from "@/lib/repayments";

export const Route = createFileRoute("/admin/repayments/cases")({
  head: () => ({
    meta: [
      { title: "Collection cases — CoopOS Nigeria" },
      { name: "description", content: "Follow-up cases, contact history and promises to pay." },
      { property: "og:title", content: "Collection cases — CoopOS Nigeria" },
      { property: "og:description", content: "Follow-up cases, contact history and promises to pay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CasesPage,
});

function CasesPage() {
  const { cooperative, user, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const [openCase, setOpenCase] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("OPEN_ONLY");

  const cases = useQuery({
    queryKey: ["collection-cases", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_cases")
        .select("*, loans(loan_number), members(first_name, last_name, member_number, phone)")
        .eq("cooperative_id", coopId!)
        .order("days_past_due", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (cases.data ?? []).filter((c) =>
    statusFilter === "OPEN_ONLY"
      ? !["RESOLVED", "CLOSED"].includes(c.status)
      : statusFilter === "ALL"
        ? true
        : c.status === statusFilter,
  );

  const canManage = hasPermission("collections.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collection cases"
        description="Each case follows one overdue loan, with every contact and promise recorded."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN_ONLY">Still open</SelectItem>
                <SelectItem value="ALL">All cases</SelectItem>
                {COLLECTION_CASE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {label(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={rows.length === 0}
              onClick={() =>
                downloadCsv(
                  "collection-cases.csv",
                  rows.map((c) => {
                    const m = c.members as { first_name?: string; last_name?: string } | null;
                    return {
                      case: c.case_number,
                      member: [m?.first_name, m?.last_name].filter(Boolean).join(" "),
                      loan: (c.loans as { loan_number?: string } | null)?.loan_number ?? "",
                      arrears: c.arrears_amount,
                      days_late: c.days_past_due,
                      priority: c.priority,
                      status: c.status,
                      next_action: c.next_action ?? "",
                      next_action_date: c.next_action_date ?? "",
                    };
                  }),
                )
              }
            >
              Export
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          {cases.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading cases…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No case here yet. Cases are opened from the delinquency page.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead className="text-right">Arrears</TableHead>
                    <TableHead className="text-right">Days late</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next step</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => {
                    const m = c.members as
                      | { first_name?: string; last_name?: string; member_number?: string }
                      | null;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.case_number}</TableCell>
                        <TableCell>
                          {[m?.first_name, m?.last_name].filter(Boolean).join(" ")}
                          <span className="block text-xs text-muted-foreground">{m?.member_number}</span>
                        </TableCell>
                        <TableCell>{(c.loans as { loan_number?: string } | null)?.loan_number}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNaira(c.arrears_amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.days_past_due}</TableCell>
                        <TableCell>
                          <Badge variant={priorityTone(c.priority)}>{label(c.priority)}</Badge>
                        </TableCell>
                        <TableCell>{label(c.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.next_action ? `${c.next_action}${c.next_action_date ? ` · ${formatDate(c.next_action_date)}` : ""}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setOpenCase(c.id)}>
                            Open
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

      <Dialog open={Boolean(openCase)} onOpenChange={(v) => !v && setOpenCase(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {openCase && (
            <CaseDetail
              caseId={openCase}
              coopId={coopId!}
              userId={user?.id ?? null}
              canManage={canManage}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CaseDetail({
  caseId,
  coopId,
  userId,
  canManage,
}: {
  caseId: string;
  coopId: string;
  userId: string | null;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [actionType, setActionType] = useState<CollectionActionType>("PHONE_CALL");
  const [outcome, setOutcome] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [promiseAmount, setPromiseAmount] = useState("");
  const [promiseDate, setPromiseDate] = useState("");

  const detail = useQuery({
    queryKey: ["collection-case", caseId],
    queryFn: async () => {
      const [c, actions, promises] = await Promise.all([
        supabase
          .from("collection_cases")
          .select("*, loans(loan_number, total_outstanding), members(first_name, last_name, member_number, phone, email)")
          .eq("id", caseId)
          .maybeSingle(),
        supabase.from("collection_actions").select("*").eq("case_id", caseId).order("action_date", { ascending: false }),
        supabase.from("promise_to_pay").select("*").eq("case_id", caseId).order("promised_date", { ascending: false }),
      ]);
      if (c.error) throw c.error;
      return { record: c.data, actions: actions.data ?? [], promises: promises.data ?? [] };
    },
  });

  const record = detail.data?.record;

  const addAction = useMutation({
    mutationFn: async () => {
      if (!outcome.trim()) throw new Error("Say what happened.");
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("collection_actions").insert({
        cooperative_id: coopId,
        case_id: caseId,
        action_type: actionType,
        action_date: today,
        officer: userId,
        outcome: outcome.trim(),
        next_action: nextAction.trim() || null,
        next_action_date: nextDate || null,
        created_by: userId,
      });
      if (error) throw error;
      const { error: upErr } = await supabase
        .from("collection_cases")
        .update({
          last_action_date: today,
          next_action: nextAction.trim() || null,
          next_action_date: nextDate || null,
          status: record?.status === "OPEN" ? ("CONTACTED" as const) : (record?.status ?? "OPEN"),
        })
        .eq("id", caseId);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Contact recorded.");
      setOutcome("");
      setNextAction("");
      setNextDate("");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const addPromise = useMutation({
    mutationFn: async () => {
      const amount = Number(promiseAmount);
      if (!(amount > 0)) throw new Error("Enter the amount promised.");
      if (!promiseDate) throw new Error("Enter the date promised.");
      const { error } = await supabase.from("promise_to_pay").insert({
        cooperative_id: coopId,
        case_id: caseId,
        loan_id: record!.loan_id,
        member_id: record!.member_id,
        amount,
        promised_date: promiseDate,
        created_by: userId,
      });
      if (error) throw error;
      await supabase.from("collection_cases").update({ status: "PROMISE_TO_PAY" }).eq("id", caseId);
    },
    onSuccess: () => {
      toast.success("Promise to pay recorded.");
      setPromiseAmount("");
      setPromiseDate("");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const updateCase = useMutation({
    mutationFn: async (patch: {
      status?: CollectionCaseStatus;
      priority?: CollectionPriority;
      closed_date?: string | null;
    }) => {
      const { error } = await supabase.from("collection_cases").update(patch).eq("id", caseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Case updated.");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const settlePromise = useMutation({
    mutationFn: async (args: { id: string; status: PromiseStatus; fulfilled: number; amount: number }) => {
      const { error } = await supabase
        .from("promise_to_pay")
        .update({
          status: args.status,
          fulfilled_amount: args.fulfilled,
          variance_amount: args.amount - args.fulfilled,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promise updated.");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  if (detail.isPending || !record) {
    return <p className="text-sm text-muted-foreground">Loading case…</p>;
  }

  const m = record.members as
    | { first_name?: string; last_name?: string; member_number?: string; phone?: string; email?: string }
    | null;

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle>
          {record.case_number} — {[m?.first_name, m?.last_name].filter(Boolean).join(" ")}
        </DialogTitle>
      </DialogHeader>

      <div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <Fact k="Loan" v={(record.loans as { loan_number?: string } | null)?.loan_number ?? "—"} />
        <Fact k="Outstanding" v={formatNaira(record.outstanding_amount)} />
        <Fact k="Arrears" v={formatNaira(record.arrears_amount)} />
        <Fact k="Days late" v={String(record.days_past_due)} />
        <Fact k="Phone" v={m?.phone ?? "—"} />
        <Fact k="Email" v={m?.email ?? "—"} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            value={record.status}
            onValueChange={(v) => updateCase.mutate({ status: v as CollectionCaseStatus, closed_date: ["RESOLVED", "CLOSED"].includes(v) ? new Date().toISOString().slice(0, 10) : null })}
            disabled={!canManage}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLLECTION_CASE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {label(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select
            value={record.priority}
            onValueChange={(v) => updateCase.mutate({ priority: v as CollectionPriority })}
            disabled={!canManage}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLLECTION_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {label(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record a contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>What was done</Label>
              <Select value={actionType} onValueChange={(v) => setActionType(v as CollectionActionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLLECTION_ACTION_TYPES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {label(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Next step date</Label>
              <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>What happened</Label>
            <Textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Next step</Label>
            <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
          </div>
          <Button onClick={() => addAction.mutate()} disabled={!canManage || addAction.isPending}>
            Save contact
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Promise to pay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={promiseAmount}
                onChange={(e) => setPromiseAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date promised</Label>
              <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => addPromise.mutate()} disabled={!canManage || addPromise.isPending}>
              Record promise
            </Button>
          </div>
          {(detail.data?.promises ?? []).length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Promised</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(detail.data?.promises ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.promised_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(p.amount)}</TableCell>
                    <TableCell>{label(p.status)}</TableCell>
                    <TableCell className="text-right">
                      {p.status === "PENDING" && canManage && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              settlePromise.mutate({
                                id: p.id,
                                status: "KEPT",
                                fulfilled: Number(p.amount),
                                amount: Number(p.amount),
                              })
                            }
                          >
                            Kept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              settlePromise.mutate({ id: p.id, status: "BROKEN", fulfilled: 0, amount: Number(p.amount) })
                            }
                          >
                            Broken
                          </Button>
                        </div>
                      )}
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
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(detail.data?.actions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            (detail.data?.actions ?? []).map((a) => (
              <div key={a.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{label(a.action_type)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(a.action_date)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{a.outcome}</p>
                {a.next_action && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Next: {a.next_action}
                    {a.next_action_date ? ` · ${formatDate(a.next_action_date)}` : ""}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{k}</p>
      <p className="font-medium">{v}</p>
    </div>
  );
}
