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
import { settleExit } from "@/lib/withdrawals-ops";
import type { Database } from "@/integrations/supabase/types";
import { formatDate, formatNaira } from "@/lib/format";
import { useSession } from "@/lib/session";
import {
  calculateExitSettlement,
  friendlyWithdrawalError,
  label,
  nextExitSettlementNumber,
  statusTone,
  type ExitSettlementStatus,
} from "@/lib/withdrawals";

export const Route = createFileRoute("/admin/withdrawals/exit-settlements")({
  head: () => ({
    meta: [
      { title: "Exit settlements — CoopOS Nigeria" },
      { name: "description", content: "Work out and approve what a leaving member is owed." },
      { property: "og:title", content: "Exit settlements — CoopOS Nigeria" },
      { property: "og:description", content: "Work out and approve what a leaving member is owed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExitSettlementsPage,
});

const EXIT_TYPES = ["RESIGNATION", "RETIREMENT", "DECEASED", "TRANSFER", "OTHER"];

function ExitSettlementsPage() {
  const { cooperative, hasPermission, user } = useSession();
  const coopId = cooperative?.id ?? null;
  const canManage = hasPermission("withdrawals.exit_settle");
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberId, setMemberId] = useState("");
  const [exitType, setExitType] = useState("RESIGNATION");
  const [noticeDate, setNoticeDate] = useState("");
  const [noticeDays, setNoticeDays] = useState("30");
  const [exitFee, setExitFee] = useState("0");

  const members = useQuery({
    queryKey: ["exit-member-options", coopId, memberSearch],
    enabled: Boolean(coopId),
    queryFn: async () => {
      let q = supabase
        .from("members")
        .select("id, first_name, last_name, membership_number")
        .eq("cooperative_id", coopId!)
        .order("last_name")
        .limit(25);
      if (memberSearch.trim()) {
        const t = `%${memberSearch.trim()}%`;
        q = q.or(`first_name.ilike.${t},last_name.ilike.${t},membership_number.ilike.${t}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const settlements = useQuery({
    queryKey: ["exit-settlements", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exit_settlements")
        .select("*, members(first_name, last_name, membership_number)")
        .eq("cooperative_id", coopId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!coopId || !memberId) throw new Error("Choose a member first.");
      const fee = Number(exitFee) || 0;
      const calc = await calculateExitSettlement(coopId, memberId, fee);
      const number = await nextExitSettlementNumber(coopId);
      const days = Number(noticeDays) || 0;
      const satisfied = noticeDate
        ? Math.floor((Date.now() - new Date(noticeDate).getTime()) / 86_400_000) >= days
        : false;
      const { error } = await supabase.from("exit_settlements").insert({
        cooperative_id: coopId,
        member_id: memberId,
        settlement_number: number,
        exit_type: exitType,
        notice_date: noticeDate || null,
        notice_required_days: days,
        notice_satisfied: satisfied,
        regular_savings: calc.regularSavings,
        special_savings: calc.specialSavings,
        other_balances: calc.otherBalances,
        outstanding_loan_principal: calc.outstandingPrincipal,
        outstanding_interest: calc.outstandingInterest,
        outstanding_fees: calc.outstandingFees,
        outstanding_penalties: calc.outstandingPenalties,
        exit_fee: fee,
        gross_entitlement: calc.grossEntitlement,
        net_settlement: calc.netSettlement,
        calculation_snapshot: calc as never,
        status: "CALCULATED",
        requested_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settlement worked out from live balances.");
      setOpen(false);
      setMemberId("");
      void qc.invalidateQueries({ queryKey: ["exit-settlements", coopId] });
    },
    onError: (e) => toast.error(friendlyWithdrawalError(e)),
  });

  const move = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: ExitSettlementStatus }) => {
      if (to === "SETTLED") {
        if (!coopId) return;
        await settleExit({
          coopId,
          settlementId: id,
          paymentDate: new Date().toISOString().slice(0, 10),
          paymentReference: null,
          userId: user?.id ?? null,
        });
        return;
      }
      const patch: Database["public"]["Tables"]["exit_settlements"]["Update"] = { status: to };
      if (to === "CHECKED") patch.checked_by = user?.id ?? null;
      if (to === "APPROVED") patch.approved_by = user?.id ?? null;
      const { error } = await supabase.from("exit_settlements").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settlement updated.");
      void qc.invalidateQueries({ queryKey: ["exit-settlements", coopId] });
      void qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) => toast.error(friendlyWithdrawalError(e)),
  });

  const nextStep = (status: string): ExitSettlementStatus | null => {
    if (status === "CALCULATED" || status === "REQUESTED" || status === "UNDER_REVIEW") return "CHECKED";
    if (status === "CHECKED") return "APPROVED";
    if (status === "APPROVED") return "SETTLED";
    return null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exit settlements"
        description="What a leaving member is owed once everything they owe is cleared."
        actions={
          <Button disabled={!canManage} onClick={() => setOpen(true)}>
            Work out a settlement
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settlements</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Notice</TableHead>
                <TableHead className="text-right">Savings</TableHead>
                <TableHead className="text-right">Owed by member</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(settlements.data ?? []).map((s) => {
                const m = s.members as { first_name: string; last_name: string } | null;
                const owed =
                  Number(s.outstanding_loan_principal) +
                  Number(s.outstanding_interest) +
                  Number(s.outstanding_fees) +
                  Number(s.outstanding_penalties) +
                  Number(s.exit_fee);
                const step = nextStep(String(s.status));
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.settlement_number}</TableCell>
                    <TableCell>{m ? `${m.first_name} ${m.last_name}` : "—"}</TableCell>
                    <TableCell>{label(s.exit_type)}</TableCell>
                    <TableCell>
                      {s.notice_date ? `${formatDate(s.notice_date)} ${s.notice_satisfied ? "✓" : "(short)"}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(s.gross_entitlement)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(owed)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(s.net_settlement)}</TableCell>
                    <TableCell>
                      <Badge variant={statusTone(s.status)}>{label(s.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {step && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canManage || move.isPending}
                          onClick={() => move.mutate({ id: s.id, to: step })}
                        >
                          {step === "SETTLED" ? "Pay & close membership" : label(step)}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(settlements.data ?? []).length === 0 && !settlements.isPending && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    No settlements yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Work out a settlement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Find member</Label>
              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Name or membership number"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Member</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a member" />
                </SelectTrigger>
                <SelectContent>
                  {(members.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} · {m.membership_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Reason for leaving</Label>
                <Select value={exitType} onValueChange={setExitType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXIT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {label(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Exit charge</Label>
                <Input value={exitFee} onChange={(e) => setExitFee(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notice given on</Label>
                <Input type="date" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notice required (days)</Label>
                <Input value={noticeDays} onChange={(e) => setNoticeDays(e.target.value)} inputMode="numeric" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!memberId || create.isPending}>
              Work it out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
