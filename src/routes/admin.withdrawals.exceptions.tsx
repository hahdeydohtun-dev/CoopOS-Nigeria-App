import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import { friendlyWithdrawalError, label, statusTone } from "@/lib/withdrawals";
import { decideBankAccountChange } from "@/lib/withdrawals-ops";

export const Route = createFileRoute("/admin/withdrawals/exceptions")({
  head: () => ({
    meta: [
      { title: "Withdrawal issues — CoopOS Nigeria" },
      { name: "description", content: "Failed payments and other withdrawal issues needing attention." },
      { property: "og:title", content: "Withdrawal issues — CoopOS Nigeria" },
      { property: "og:description", content: "Failed payments and other withdrawal issues needing attention." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WithdrawalExceptionsPage,
});

function WithdrawalExceptionsPage() {
  const { cooperative, hasPermission, user } = useSession();
  const coopId = cooperative?.id ?? null;
  const qc = useQueryClient();

  const rows = useQuery({
    queryKey: ["withdrawal-exceptions", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_exceptions")
        .select("*, withdrawal_requests(withdrawal_number)")
        .eq("cooperative_id", coopId!)
        .order("detected_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("withdrawal_exceptions")
        .update({
          status: "RESOLVED",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as resolved.");
      void qc.invalidateQueries({ queryKey: ["withdrawal-exceptions", coopId] });
    },
    onError: (e) => toast.error(friendlyWithdrawalError(e)),
  });

  const bankChanges = useQuery({
    queryKey: ["bank-change-requests", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_bank_accounts")
        .select(
          "id, bank_name, account_number, account_name, is_verified, change_status, change_reason, created_at, members(first_name, last_name, membership_number)",
        )
        .eq("cooperative_id", coopId!)
        .eq("change_status", "PENDING")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const decideBank = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "VERIFY" | "APPROVE" | "REJECT" }) => {
      if (!coopId) return;
      await decideBankAccountChange({
        coopId,
        accountId: id,
        action,
        reason: action === "REJECT" ? "The account details could not be confirmed." : null,
        userId: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Payout account updated.");
      void qc.invalidateQueries({ queryKey: ["bank-change-requests", coopId] });
    },
    onError: (e) => toast.error(friendlyWithdrawalError(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdrawal issues"
        description="Anything that stopped a withdrawal, plus payout accounts waiting to be checked."
      />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Found</TableHead>
                <TableHead>Withdrawal</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows.data ?? []).map((x) => {
                const req = x.withdrawal_requests as { withdrawal_number: string } | null;
                return (
                  <TableRow key={x.id}>
                    <TableCell>{formatDateTime(x.detected_at)}</TableCell>
                    <TableCell>
                      {x.withdrawal_request_id ? (
                        <Link
                          to="/admin/withdrawals/$withdrawalId"
                          params={{ withdrawalId: x.withdrawal_request_id }}
                          className="underline-offset-2 hover:underline"
                        >
                          {req?.withdrawal_number ?? "View"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{label(x.exception_type)}</TableCell>
                    <TableCell className="max-w-sm truncate">{x.detail ?? "—"}</TableCell>
                    <TableCell>{label(x.severity)}</TableCell>
                    <TableCell>
                      <Badge variant={statusTone(x.status === "RESOLVED" ? "COMPLETED" : x.status)}>
                        {label(x.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {x.status === "OPEN" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!hasPermission("withdrawals.check")}
                          onClick={() => resolve.mutate(x.id)}
                        >
                          Mark resolved
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(rows.data ?? []).length === 0 && !rows.isPending && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No issues recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Bank account</TableHead>
                <TableHead>Reason given</TableHead>
                <TableHead>Checked</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(bankChanges.data ?? []).map((b) => {
                const m = b.members as { first_name: string; last_name: string } | null;
                return (
                  <TableRow key={b.id}>
                    <TableCell>{m ? `${m.first_name} ${m.last_name}` : "—"}</TableCell>
                    <TableCell>
                      {b.bank_name} · {b.account_number}
                      <div className="text-xs text-muted-foreground">{b.account_name}</div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{b.change_reason ?? "—"}</TableCell>
                    <TableCell>{b.is_verified ? "Yes" : "Not yet"}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      {!b.is_verified && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!hasPermission("withdrawals.check") || decideBank.isPending}
                          onClick={() => decideBank.mutate({ id: b.id, action: "VERIFY" })}
                        >
                          Confirm details
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={!b.is_verified || !hasPermission("withdrawals.approve") || decideBank.isPending}
                        onClick={() => decideBank.mutate({ id: b.id, action: "APPROVE" })}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!hasPermission("withdrawals.check") || decideBank.isPending}
                        onClick={() => decideBank.mutate({ id: b.id, action: "REJECT" })}
                      >
                        Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(bankChanges.data ?? []).length === 0 && !bankChanges.isPending && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No payout account changes waiting.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
