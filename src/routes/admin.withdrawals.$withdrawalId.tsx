import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatDateTime, formatNaira } from "@/lib/format";
import { useSession } from "@/lib/session";
import { friendlyWithdrawalError, label, reverseWithdrawal, statusTone } from "@/lib/withdrawals";

export const Route = createFileRoute("/admin/withdrawals/$withdrawalId")({
  head: () => ({
    meta: [
      { title: "Withdrawal detail — CoopOS Nigeria" },
      { name: "description", content: "Everything recorded about one member withdrawal." },
      { property: "og:title", content: "Withdrawal detail — CoopOS Nigeria" },
      { property: "og:description", content: "Everything recorded about one member withdrawal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WithdrawalDetailPage,
});

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{k}</span>
      <span className="text-sm font-medium tabular-nums">{v}</span>
    </div>
  );
}

function WithdrawalDetailPage() {
  const { withdrawalId } = Route.useParams();
  const { cooperative, hasPermission, user } = useSession();
  const coopId = cooperative?.id ?? null;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const request = useQuery({
    queryKey: ["withdrawal", withdrawalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select(
          "*, members(first_name, last_name, membership_number), withdrawal_types(name, code), member_bank_accounts(bank_name, account_number, account_name)",
        )
        .eq("id", withdrawalId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const checks = useQuery({
    queryKey: ["withdrawal-checks", withdrawalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_eligibility_checks")
        .select("*")
        .eq("withdrawal_request_id", withdrawalId)
        .order("calculated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const payouts = useQuery({
    queryKey: ["withdrawal-payouts", withdrawalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_payouts")
        .select("*")
        .eq("withdrawal_request_id", withdrawalId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reverse = useMutation({
    mutationFn: async () => {
      if (!coopId) return;
      await reverseWithdrawal({
        coopId,
        requestId: withdrawalId,
        reason: reason.trim(),
        reversalDate: date,
        userId: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Withdrawal reversed. The original stays on record.");
      setOpen(false);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["withdrawal", withdrawalId] });
    },
    onError: (e) => toast.error(friendlyWithdrawalError(e)),
  });

  const r = request.data;
  const member = r?.members as { first_name: string; last_name: string; membership_number: string } | null;
  const type = r?.withdrawal_types as { name: string } | null;
  const bank = r?.member_bank_accounts as
    | { bank_name: string; account_number: string; account_name: string }
    | null;
  const check = checks.data?.[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={r?.withdrawal_number ?? "Withdrawal"}
        description={member ? `${member.first_name} ${member.last_name} · ${member.membership_number}` : ""}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/withdrawals/pending">Back to queue</Link>
            </Button>
            {r?.status === "COMPLETED" && (
              <Button
                variant="destructive"
                disabled={!hasPermission("withdrawals.reverse")}
                onClick={() => setOpen(true)}
              >
                Reverse
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Request</CardTitle>
            {r && <Badge variant={statusTone(r.status)}>{label(r.status)}</Badge>}
          </CardHeader>
          <CardContent className="pt-0">
            <Row k="Type" v={type?.name ?? "—"} />
            <Row k="Requested" v={formatNaira(r?.requested_amount ?? 0)} />
            <Row k="Allowed by the rules" v={formatNaira(r?.eligible_amount ?? 0)} />
            <Row k="Approved" v={r?.approved_amount != null ? formatNaira(r.approved_amount) : "—"} />
            <Row k="Charge" v={formatNaira(r?.fee_amount ?? 0)} />
            <Row k="Net payout" v={formatNaira(r?.net_payout_amount ?? 0)} />
            <Row k="Request date" v={formatDate(r?.request_date)} />
            <Row k="Reason given" v={r?.purpose || "—"} />
            <Row
              k="Payout account"
              v={bank ? `${bank.bank_name} · ${bank.account_number}` : "Not selected"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eligibility at the time of the decision</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {check ? (
              <>
                <Row k="Savings balance" v={formatNaira(check.savings_balance)} />
                <Row k="Restricted or pledged" v={formatNaira(check.pledged_balance)} />
                <Row k="Held for other requests" v={formatNaira(check.reserved_balance)} />
                <Row k="Available" v={formatNaira(check.available_balance)} />
                <Row k="Outstanding loans" v={formatNaira(check.outstanding_loan_balance)} />
                <Row k="Overdue" v={formatNaira(check.overdue_amount)} />
                <Row k="Membership (months)" v={String(check.membership_tenure_months)} />
                <Row k="Saving for (months)" v={String(check.savings_tenure_months)} />
                <Row k="Most this member may take" v={formatNaira(check.maximum_allowed)} />
                <Row k="Outcome" v={label(check.eligibility_status)} />
                {check.failure_reasons.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {check.failure_reasons.map((reasonText) => (
                      <li key={reasonText}>{reasonText}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No eligibility record.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {(payouts.data ?? []).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
              <span className="text-sm">{formatDateTime(p.processed_at ?? p.created_at)}</span>
              <span className="text-sm tabular-nums">{formatNaira(p.amount)}</span>
              <span className="text-sm text-muted-foreground">{p.bank_reference ?? p.payment_reference ?? "—"}</span>
              <Badge variant={statusTone(p.status)}>{label(p.status)}</Badge>
            </div>
          ))}
          {(payouts.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No payment recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse this withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Why</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => reverse.mutate()} disabled={!reason.trim() || reverse.isPending}>
              Reverse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
