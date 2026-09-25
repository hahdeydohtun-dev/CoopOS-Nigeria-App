import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNaira } from "@/lib/format";
import { useSession } from "@/lib/session";
import { requestBankAccountChange } from "@/lib/withdrawals-ops";
import {
  createWithdrawalRequest,
  evaluateEligibility,
  friendlyWithdrawalError,
  label,
  loadMemberPosition,
  statusTone,
  type WithdrawalType,
} from "@/lib/withdrawals";

export const Route = createFileRoute("/portal/withdrawals")({
  head: () => ({
    meta: [
      { title: "My withdrawals — CoopOS Nigeria" },
      { name: "description", content: "See what you can withdraw, request it and follow the payment." },
      { property: "og:title", content: "My withdrawals — CoopOS Nigeria" },
      { property: "og:description", content: "See what you can withdraw, request it and follow the payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalWithdrawalsPage,
});

function PortalWithdrawalsPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [typeId, setTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [bankId, setBankId] = useState("");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newBank, setNewBank] = useState({ bank_name: "", account_number: "", account_name: "", reason: "" });

  const member = useQuery({
    queryKey: ["portal-member", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, cooperative_id, first_name, last_name, membership_number")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const coopId = member.data?.cooperative_id ?? null;
  const memberId = member.data?.id ?? null;

  const types = useQuery({
    queryKey: ["portal-withdrawal-types", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_types")
        .select("*")
        .eq("cooperative_id", coopId!)
        .eq("active", true)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const selectedType = useMemo(
    () => (types.data ?? []).find((t) => t.id === typeId) ?? null,
    [types.data, typeId],
  );

  const position = useQuery({
    queryKey: ["portal-position", coopId, memberId, typeId],
    enabled: Boolean(coopId && memberId),
    queryFn: () => loadMemberPosition(coopId!, memberId!, selectedType as WithdrawalType | null),
  });

  const banks = useQuery({
    queryKey: ["portal-banks", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_bank_accounts")
        .select("id, bank_name, account_number, account_name, is_verified, active")
        .eq("member_id", memberId!)
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const requests = useQuery({
    queryKey: ["portal-withdrawals", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select(
          "id, withdrawal_number, request_date, status, requested_amount, approved_amount, fee_amount, net_payout_amount, withdrawal_types(name)",
        )
        .eq("member_id", memberId!)
        .order("request_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const evaluation = useMemo(() => {
    if (!selectedType || !position.data) return null;
    return evaluateEligibility(selectedType as WithdrawalType, position.data, Number(amount) || 0);
  }, [selectedType, position.data, amount]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!coopId || !memberId || !selectedType) throw new Error("Choose what you want to withdraw.");
      await createWithdrawalRequest({
        coopId,
        memberId,
        type: selectedType as WithdrawalType,
        savingsAccountId: null,
        requestedAmount: Number(amount) || 0,
        purpose: purpose.trim() || null,
        bankAccountId: bankId || null,
        requestedPaymentDate: null,
        documentId,
        userId: user?.id ?? null,
        submit: true,
      });
    },
    onSuccess: () => {
      toast.success("Request sent for review.");
      setAmount("");
      setPurpose("");
      setDocumentId(null);
      void qc.invalidateQueries({ queryKey: ["portal-withdrawals", memberId] });
      void qc.invalidateQueries({ queryKey: ["portal-position"] });
    },
    onError: (e) => toast.error(friendlyWithdrawalError(e)),
  });

  const uploadDocument = async (file: File) => {
    if (!coopId || !memberId) return;
    setUploading(true);
    try {
      const path = `${coopId}/${memberId}/withdrawals/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const { error: upErr } = await supabase.storage.from("member-documents").upload(path, file);
      if (upErr) throw upErr;
      const { data, error } = await supabase
        .from("member_documents")
        .insert({
          cooperative_id: coopId,
          member_id: memberId,
          document_type: "WITHDRAWAL_SUPPORT",
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
          storage_path: path,
        })
        .select("id")
        .single();
      if (error) throw error;
      setDocumentId(data.id);
      toast.success("Document attached.");
    } catch (e) {
      toast.error(friendlyWithdrawalError(e));
    } finally {
      setUploading(false);
    }
  };

  const bankRequest = useMutation({
    mutationFn: async () => {
      if (!coopId || !memberId) throw new Error("We could not find your membership.");
      await requestBankAccountChange({
        coopId,
        memberId,
        bankName: newBank.bank_name,
        bankCode: null,
        accountNumber: newBank.account_number,
        accountName: newBank.account_name,
        reason: newBank.reason || null,
        userId: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Sent for checking. We will use it once it is approved.");
      setNewBank({ bank_name: "", account_number: "", account_name: "", reason: "" });
      void qc.invalidateQueries({ queryKey: ["portal-banks", memberId] });
    },
    onError: (e) => toast.error(friendlyWithdrawalError(e)),
  });

  const p = position.data;

  return (
    <div className="space-y-6">
      <PageHeader title="My withdrawals" description="What you can take out, and how your requests are going." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request a withdrawal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">What kind of withdrawal</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {(types.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {p && (
              <div className="rounded-md border p-3 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Your savings</span>
                  <span className="tabular-nums">{formatNaira(p.savingsBalance)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Held or pledged</span>
                  <span className="tabular-nums">{formatNaira(p.lockedBalance + p.activeHolds)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Most you may take now</span>
                  <span className="font-medium tabular-nums">{formatNaira(evaluation?.maximumAllowed ?? 0)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Amount</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </div>

            {selectedType?.requires_purpose && (
              <div className="space-y-1.5">
                <Label className="text-xs">Reason</Label>
                <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} />
              </div>
            )}

            {selectedType?.requires_document && (
              <div className="space-y-1.5">
                <Label className="text-xs">Supporting document</Label>
                <Input
                  type="file"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadDocument(file);
                  }}
                />
                {documentId && <p className="text-xs text-muted-foreground">Document attached.</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Pay into</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a bank account" />
                </SelectTrigger>
                <SelectContent>
                  {(banks.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bank_name} · {b.account_number}
                      {b.is_verified ? "" : " (not yet verified)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {evaluation && (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Allowed</span>
                  <span className="tabular-nums">{formatNaira(evaluation.eligibleAmount)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Charge</span>
                  <span className="tabular-nums">{formatNaira(evaluation.fee)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">You would receive</span>
                  <span className="font-medium tabular-nums">{formatNaira(evaluation.netPayout)}</span>
                </div>
                {evaluation.failureReasons.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-destructive">
                    {evaluation.failureReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => submit.mutate()}
              disabled={
                submit.isPending ||
                !selectedType ||
                !(Number(amount) > 0) ||
                evaluation?.status === "NOT_ELIGIBLE"
              }
            >
              Send request
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">My requests</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">You receive</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(requests.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.withdrawal_number}</TableCell>
                    <TableCell>{formatDate(r.request_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNaira(r.approved_amount ?? r.requested_amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(r.net_payout_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={statusTone(r.status)}>{label(r.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(requests.data ?? []).length === 0 && !requests.isPending && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      You have not requested a withdrawal yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add or change a payout account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A new account is checked and approved by the cooperative before any money is sent to it.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Bank</Label>
                <Input
                  value={newBank.bank_name}
                  onChange={(e) => setNewBank({ ...newBank, bank_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Account number</Label>
                <Input
                  value={newBank.account_number}
                  onChange={(e) => setNewBank({ ...newBank, account_number: e.target.value })}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Account name</Label>
                <Input
                  value={newBank.account_name}
                  onChange={(e) => setNewBank({ ...newBank, account_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Why you are changing it (optional)</Label>
                <Textarea
                  rows={2}
                  value={newBank.reason}
                  onChange={(e) => setNewBank({ ...newBank, reason: e.target.value })}
                />
              </div>
            </div>
            <Button variant="outline" onClick={() => bankRequest.mutate()} disabled={bankRequest.isPending}>
              Send for checking
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
