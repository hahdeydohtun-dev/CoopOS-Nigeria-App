import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatDate, formatNaira } from "@/lib/format";
import { useSession } from "@/lib/session";
import {
  friendlyWithdrawalError,
  label,
  moveWithdrawal,
  nextStatuses,
  processWithdrawalPayout,
  recordPayoutFailure,
  statusTone,
  WITHDRAWAL_STATUSES,
  type WithdrawalStatus,
} from "@/lib/withdrawals";

export const Route = createFileRoute("/admin/withdrawals/pending")({
  head: () => ({
    meta: [
      { title: "Withdrawal queue — CoopOS Nigeria" },
      { name: "description", content: "Check, approve and pay member withdrawal requests." },
      { property: "og:title", content: "Withdrawal queue — CoopOS Nigeria" },
      { property: "og:description", content: "Check, approve and pay member withdrawal requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WithdrawalQueuePage,
});

const today = () => new Date().toISOString().slice(0, 10);

function WithdrawalQueuePage() {
  const { cooperative, hasPermission, user } = useSession();
  const coopId = cooperative?.id ?? null;
  const qc = useQueryClient();

  const [status, setStatus] = useState<string>("PENDING");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<{ id: string; to: WithdrawalStatus; number: string } | null>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [payFor, setPayFor] = useState<{ id: string; number: string; amount: number } | null>(null);
  const [reference, setReference] = useState("");
  const [payDate, setPayDate] = useState(today());
  const [failFor, setFailFor] = useState<{ id: string; number: string } | null>(null);
  const [failReason, setFailReason] = useState("");

  const requests = useQuery({
    queryKey: ["withdrawal-queue", coopId, status, search],
    enabled: Boolean(coopId),
    queryFn: async () => {
      let q = supabase
        .from("withdrawal_requests")
        .select(
          "id, withdrawal_number, requested_amount, eligible_amount, approved_amount, fee_amount, net_payout_amount, status, eligibility_status, request_date, purpose, members(first_name, last_name, membership_number), withdrawal_types(name)",
        )
        .eq("cooperative_id", coopId!)
        .order("request_date", { ascending: false })
        .limit(200);
      if (status === "PENDING") {
        q = q.in("status", ["SUBMITTED", "UNDER_REVIEW", "CHECKED", "APPROVED", "PAYMENT_PENDING", "PROCESSING", "FAILED"]);
      } else if (status !== "ALL") {
        q = q.eq("status", status as WithdrawalStatus);
      }
      if (search.trim()) q = q.ilike("withdrawal_number", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const move = useMutation({
    mutationFn: async () => {
      if (!coopId || !decision) return;
      await moveWithdrawal({
        coopId,
        requestId: decision.id,
        to: decision.to,
        userId: user?.id ?? null,
        reason: reason.trim() || null,
        approvedAmount: amount ? Number(amount) : null,
      });
    },
    onSuccess: () => {
      toast.success("Request updated.");
      setDecision(null);
      setReason("");
      setAmount("");
      void qc.invalidateQueries({ queryKey: ["withdrawal-queue"] });
    },
    onError: (e) => toast.error(friendlyWithdrawalError(e)),
  });

  const pay = useMutation({
    mutationFn: async () => {
      if (!coopId || !payFor) return;
      await processWithdrawalPayout({
        coopId,
        requestId: payFor.id,
        paymentReference: reference.trim() || null,
        paymentProvider: null,
        bankReference: reference.trim() || null,
        paymentDate: payDate,
        userId: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded and savings updated.");
      setPayFor(null);
      setReference("");
      void qc.invalidateQueries({ queryKey: ["withdrawal-queue"] });
    },
    onError: (e) => toast.error(friendlyWithdrawalError(e)),
  });

  const fail = useMutation({
    mutationFn: async () => {
      if (!coopId || !failFor) return;
      if (!failReason.trim()) throw new Error("Say what went wrong with the payment.");
      await recordPayoutFailure({
        coopId,
        requestId: failFor.id,
        reason: failReason.trim(),
        userId: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Payment marked as failed. It can be tried again.");
      setFailFor(null);
      setFailReason("");
      void qc.invalidateQueries({ queryKey: ["withdrawal-queue"] });
    },
    onError: (e) => toast.error(friendlyWithdrawalError(e)),
  });

  const canAct = (to: WithdrawalStatus) => {
    if (to === "CHECKED") return hasPermission("withdrawals.check");
    if (to === "APPROVED") return hasPermission("withdrawals.approve");
    if (to === "REJECTED") return hasPermission("withdrawals.check") || hasPermission("withdrawals.approve");
    if (to === "CANCELLED") return hasPermission("withdrawals.create");
    return hasPermission("withdrawals.process");
  };

  const rows = requests.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Withdrawal queue" description="Check, approve and pay member withdrawal requests." />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Search number</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="WD-2026-000001" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Awaiting action</SelectItem>
                <SelectItem value="ALL">All</SelectItem>
                {WITHDRAWAL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {label(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead className="text-right">Allowed</TableHead>
                <TableHead className="text-right">Net payout</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const member = r.members as { first_name: string; last_name: string } | null;
                const type = r.withdrawal_types as { name: string } | null;
                const options = nextStatuses(r.status as WithdrawalStatus);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        to="/admin/withdrawals/$withdrawalId"
                        params={{ withdrawalId: r.id }}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {r.withdrawal_number}
                      </Link>
                    </TableCell>
                    <TableCell>{member ? `${member.first_name} ${member.last_name}` : "—"}</TableCell>
                    <TableCell>{type?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(r.requested_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(r.eligible_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(r.net_payout_amount)}</TableCell>
                    <TableCell>{formatDate(r.request_date)}</TableCell>
                    <TableCell>
                      <Badge variant={statusTone(r.status)}>{label(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      {options
                        .filter((o) => o !== "PAYMENT_PENDING" && o !== "COMPLETED" && o !== "FAILED" && o !== "REVERSED")
                        .map((o) => (
                          <Button
                            key={o}
                            size="sm"
                            variant={o === "REJECTED" || o === "CANCELLED" ? "outline" : "default"}
                            disabled={!canAct(o)}
                            onClick={() => {
                              setDecision({ id: r.id, to: o, number: r.withdrawal_number });
                              setAmount(o === "APPROVED" ? String(r.eligible_amount ?? "") : "");
                            }}
                          >
                            {label(o)}
                          </Button>
                        ))}
                      {["APPROVED", "PAYMENT_PENDING", "PROCESSING", "FAILED"].includes(String(r.status)) && (
                        <Button
                          size="sm"
                          disabled={!hasPermission("withdrawals.process")}
                          onClick={() =>
                            setPayFor({
                              id: r.id,
                              number: r.withdrawal_number,
                              amount: Number(r.net_payout_amount ?? 0),
                            })
                          }
                        >
                          {r.status === "FAILED" ? "Try payment again" : "Record payment"}
                        </Button>
                      )}
                      {["APPROVED", "PAYMENT_PENDING", "PROCESSING"].includes(String(r.status)) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!hasPermission("withdrawals.process")}
                          onClick={() => setFailFor({ id: r.id, number: r.withdrawal_number })}
                        >
                          Payment failed
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && !requests.isPending && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Nothing in this list.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(decision)} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision ? `${label(decision.to)} ${decision.number}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {decision?.to === "APPROVED" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Approved amount</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">
                {decision?.to === "REJECTED" || decision?.to === "CANCELLED" ? "Reason" : "Note (optional)"}
              </Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => move.mutate()}
              disabled={
                move.isPending ||
                ((decision?.to === "REJECTED" || decision?.to === "CANCELLED") && !reason.trim())
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(failFor)} onOpenChange={(open) => !open && setFailFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{failFor ? `Payment failed for ${failFor.number}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">What went wrong</Label>
            <Textarea value={failReason} onChange={(e) => setFailReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => fail.mutate()} disabled={fail.isPending}>
              Mark as failed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(payFor)} onOpenChange={(open) => !open && setPayFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{payFor ? `Record payment for ${payFor.number}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Amount to pay: <span className="font-medium text-foreground">{formatNaira(payFor?.amount ?? 0)}</span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Bank reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment date</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending}>
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
