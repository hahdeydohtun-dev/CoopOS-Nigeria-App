import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDate, formatNaira } from "@/lib/format";
import {
  JOURNAL_STATUSES,
  downloadCsv,
  friendlyAccountingError,
  journalStatusTone,
  label as human,
  today,
  type JournalStatus,
} from "@/lib/accounting";

export const Route = createFileRoute("/admin/accounting/journals")({
  head: () => ({
    meta: [
      { title: "Journals — CoopOS Nigeria" },
      {
        name: "description",
        content: "Every journal raised automatically or by hand, with check, approve and post.",
      },
      { property: "og:title", content: "Journals — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Every journal raised automatically or by hand, with check, approve and post.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JournalsPage,
});

type Journal = {
  id: string;
  journal_number: string | null;
  journal_type: string | null;
  posting_date: string;
  description: string | null;
  reference: string | null;
  status: JournalStatus;
  total_debit: number | null;
  total_credit: number | null;
  source_type: string | null;
  created_by: string | null;
};

type LineDraft = { account_id: string; debit: string; credit: string; description: string };

const blankLine = (): LineDraft => ({ account_id: "", debit: "", credit: "", description: "" });

function JournalsPage() {
  const { cooperative, hasPermission, user } = useSession();
  const coopId = cooperative?.id ?? null;
  const qc = useQueryClient();

  const can = {
    edit: hasPermission("accounting.edit"),
    post: hasPermission("accounting.post"),
    approve: hasPermission("accounting.approve"),
    reverse: hasPermission("accounting.reverse"),
  };

  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Journal | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [reverseOf, setReverseOf] = useState<Journal | null>(null);
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState({
    posting_date: today(),
    description: "",
    reference: "",
    lines: [blankLine(), blankLine()],
  });

  const accounts = useQuery({
    queryKey: ["coa-simple", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, is_active")
        .eq("cooperative_id", coopId!)
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const journals = useQuery({
    queryKey: ["journals", coopId, status, search],
    enabled: Boolean(coopId),
    queryFn: async () => {
      let q = supabase
        .from("journal_entries")
        .select(
          "id, journal_number, journal_type, posting_date, description, reference, status, total_debit, total_credit, source_type, created_by",
        )
        .eq("cooperative_id", coopId!)
        .order("posting_date", { ascending: false })
        .limit(200);
      if (status !== "ALL") q = q.eq("status", status as JournalStatus);
      if (search.trim()) q = q.ilike("journal_number", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Journal[];
    },
  });

  const lines = useQuery({
    queryKey: ["journal-lines", detail?.id],
    enabled: Boolean(detail?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_lines")
        .select("id, debit, credit, description, account_id, chart_of_accounts(code, name)")
        .eq("journal_id", detail!.id)
        .order("line_sequence");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const usable = draft.lines.filter(
        (l) => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0),
      );
      const debit = usable.reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const credit = usable.reduce((s, l) => s + (Number(l.credit) || 0), 0);
      if (usable.length < 2) throw new Error("A journal needs at least two lines.");
      if (Math.abs(debit - credit) > 0.004) throw new Error("unbalanced");

      const { data: number, error: numErr } = await supabase.rpc("next_journal_number", {
        _cooperative_id: coopId!,
      });
      if (numErr) throw numErr;

      const { data: period } = await supabase
        .from("accounting_periods")
        .select("id")
        .eq("cooperative_id", coopId!)
        .lte("start_date", draft.posting_date)
        .gte("end_date", draft.posting_date)
        .maybeSingle();

      const { data: entry, error: insErr } = await supabase
        .from("journal_entries")
        .insert({
          cooperative_id: coopId!,
          journal_number: number as string,
          journal_type: "MANUAL",
          posting_date: draft.posting_date,
          description: draft.description.trim(),
          reference: draft.reference.trim() || null,
          status: "DRAFT",
          period_id: period?.id ?? null,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      const { error: lineErr } = await supabase.from("journal_lines").insert(
        usable.map((l, i) => ({
          journal_id: entry.id,
          account_id: l.account_id,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description.trim() || null,
          line_sequence: i + 1,
        })),
      );
      if (lineErr) throw lineErr;
    },
    onSuccess: () => {
      toast.success("Journal saved as a draft.");
      setNewOpen(false);
      setDraft({ posting_date: today(), description: "", reference: "", lines: [blankLine(), blankLine()] });
      void qc.invalidateQueries({ queryKey: ["journals", coopId] });
    },
    onError: (e) => toast.error(friendlyAccountingError(e)),
  });

  const move = useMutation({
    mutationFn: async ({ row, to }: { row: Journal; to: JournalStatus }) => {
      if (to === "POSTED") {
        const { error } = await supabase.rpc("post_manual_journal", { _journal_id: row.id });
        if (error) throw error;
        return;
      }
      const patch: import("@/integrations/supabase/types").Database["public"]["Tables"]["journal_entries"]["Update"] = { status: to };
      if (to === "CHECKED") {
        patch["checked_by"] = user?.id ?? null;
        patch["checked_at"] = new Date().toISOString();
      }
      if (to === "APPROVED") {
        patch["approved_by"] = user?.id ?? null;
        patch["approved_at"] = new Date().toISOString();
      }
      const { error } = await supabase.from("journal_entries").update(patch).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Journal updated.");
      void qc.invalidateQueries({ queryKey: ["journals", coopId] });
    },
    onError: (e) => toast.error(friendlyAccountingError(e)),
  });

  const reverse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("reverse_journal", {
        _journal_id: reverseOf!.id,
        _reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reversal posted. The original journal stays on the record.");
      setReverseOf(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["journals", coopId] });
    },
    onError: (e) => toast.error(friendlyAccountingError(e)),
  });

  const actionsFor = (j: Journal): JournalStatus[] => {
    if (j.journal_type && j.journal_type !== "MANUAL" && j.journal_type !== "TEMPLATE") return [];
    if (j.status === "DRAFT") return can.edit ? ["SUBMITTED"] : [];
    if (j.status === "SUBMITTED") return can.approve || can.post ? ["CHECKED", "REJECTED"] : [];
    if (j.status === "CHECKED") return can.approve ? ["APPROVED", "REJECTED"] : [];
    if (j.status === "APPROVED") return can.post ? ["POSTED"] : [];
    return [];
  };

  const draftTotals = draft.lines.reduce(
    (t, l) => ({ d: t.d + (Number(l.debit) || 0), c: t.c + (Number(l.credit) || 0) }),
    { d: 0, c: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journals"
        description="Automatic journals come from savings, check-off, loans, repayments and withdrawals. Manual journals follow raise → check → approve → post."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "journals.csv",
                  (journals.data ?? []).map((j) => ({
                    number: j.journal_number,
                    date: j.posting_date,
                    type: j.journal_type,
                    description: j.description,
                    debit: j.total_debit,
                    credit: j.total_credit,
                    status: j.status,
                  })),
                )
              }
            >
              Export
            </Button>
            {can.edit && <Button onClick={() => setNewOpen(true)}>New journal</Button>}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search journal number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {JOURNAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {human(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {journals.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading journals…</p>
          ) : (journals.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No journals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Journal</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(journals.data ?? []).map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-medium">
                        <button className="hover:underline" onClick={() => setDetail(j)}>
                          {j.journal_number ?? "—"}
                        </button>
                      </TableCell>
                      <TableCell>{formatDate(j.posting_date)}</TableCell>
                      <TableCell className="max-w-xs truncate">{j.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {human(j.journal_type)}
                      </TableCell>
                      <TableCell className="text-right">{formatNaira(j.total_debit ?? 0)}</TableCell>
                      <TableCell>
                        <Badge variant={journalStatusTone(j.status)}>{human(j.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {actionsFor(j).map((to) => (
                            <Button
                              key={to}
                              size="sm"
                              variant={to === "POSTED" ? "default" : "outline"}
                              disabled={move.isPending}
                              onClick={() => move.mutate({ row: j, to })}
                            >
                              {to === "REJECTED" ? "Reject" : human(to)}
                            </Button>
                          ))}
                          {j.status === "POSTED" && can.reverse && (
                            <Button size="sm" variant="destructive" onClick={() => setReverseOf(j)}>
                              Reverse
                            </Button>
                          )}
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

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.journal_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{detail?.description}</p>
            <p>
              {formatDate(detail?.posting_date)} · {human(detail?.journal_type)} ·{" "}
              {human(detail?.status)}
            </p>
            {lines.isPending ? (
              <p className="text-muted-foreground">Loading lines…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(lines.data ?? []).map((l) => {
                    const acc = l.chart_of_accounts as unknown as {
                      code: string;
                      name: string;
                    } | null;
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground">
                            {acc?.code}
                          </span>{" "}
                          {acc?.name}
                          {l.description && (
                            <span className="block text-xs text-muted-foreground">
                              {l.description}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(l.debit) ? formatNaira(l.debit) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(l.credit) ? formatNaira(l.credit) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>New manual journal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={draft.posting_date}
                  onChange={(e) => setDraft({ ...draft, posting_date: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Description</Label>
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              {draft.lines.map((l, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
                  <Select
                    value={l.account_id || "NONE"}
                    onValueChange={(v) => {
                      const next = [...draft.lines];
                      next[i] = { ...l, account_id: v === "NONE" ? "" : v };
                      setDraft({ ...draft, lines: next });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Choose an account</SelectItem>
                      {(accounts.data ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    inputMode="decimal"
                    placeholder="Debit"
                    value={l.debit}
                    onChange={(e) => {
                      const next = [...draft.lines];
                      next[i] = { ...l, debit: e.target.value, credit: "" };
                      setDraft({ ...draft, lines: next });
                    }}
                  />
                  <Input
                    inputMode="decimal"
                    placeholder="Credit"
                    value={l.credit}
                    onChange={(e) => {
                      const next = [...draft.lines];
                      next[i] = { ...l, credit: e.target.value, debit: "" };
                      setDraft({ ...draft, lines: next });
                    }}
                  />
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDraft({ ...draft, lines: [...draft.lines, blankLine()] })}
              >
                Add line
              </Button>
            </div>
            <p className="text-sm">
              Debits {formatNaira(draftTotals.d)} · Credits {formatNaira(draftTotals.c)}
              {Math.abs(draftTotals.d - draftTotals.c) > 0.004 && (
                <span className="ml-2 text-destructive">Does not balance yet</span>
              )}
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending ||
                !draft.description.trim() ||
                Math.abs(draftTotals.d - draftTotals.c) > 0.004 ||
                draftTotals.d === 0
              }
            >
              {create.isPending ? "Saving…" : "Save draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reverseOf)} onOpenChange={(o) => !o && setReverseOf(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse {reverseOf?.journal_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              The original journal is never deleted. An opposite journal is posted against it.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => reverse.mutate()}
              disabled={reverse.isPending || reason.trim().length < 3}
            >
              {reverse.isPending ? "Posting…" : "Post reversal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
