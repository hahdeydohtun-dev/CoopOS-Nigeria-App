import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkContributionUpload } from "@/components/savings/bulk-contribution-upload";
import { SplitReceipt } from "@/components/savings/split-receipt";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDate, formatNaira } from "@/lib/format";
import {
  MANUAL_TRANSACTION_TYPES,
  SOURCES,
  friendlySavingsError,
  label,
  periodNameFor,
  transactionStatusTone,
  type SavingsSource,
  type SavingsTransactionType,
} from "@/lib/savings";

export const Route = createFileRoute("/admin/savings/contributions")({
  head: () => ({
    meta: [
      { title: "Contributions — CoopOS Nigeria" },
      { name: "description", content: "Record member contributions and review contribution activity." },
      { property: "og:title", content: "Contributions — CoopOS Nigeria" },
      { property: "og:description", content: "Record member contributions and review contribution activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContributionsPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function ContributionsPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const canCreate = hasPermission("savings.create");
  const qc = useQueryClient();

  const [memberSearch, setMemberSearch] = useState("");
  const [memberId, setMemberId] = useState("");
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<SavingsTransactionType>("CONTRIBUTION");
  const [source, setSource] = useState<SavingsSource>("BANK_TRANSFER");
  const [amount, setAmount] = useState("");
  const [txDate, setTxDate] = useState(today());
  const [valueDate, setValueDate] = useState(today());
  const [reference, setReference] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [description, setDescription] = useState("");
  const [periodId, setPeriodId] = useState<string>("NONE");
  const [duplicate, setDuplicate] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ["savings-products", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_products")
        .select("id, product_code, product_name, minimum_contribution, maximum_contribution")
        .eq("cooperative_id", coopId!)
        .eq("status", "ACTIVE")
        .order("product_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const periods = useQuery({
    queryKey: ["contribution-periods", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribution_periods")
        .select("id, name, status, start_date, end_date, due_date")
        .eq("cooperative_id", coopId!)
        .order("start_date", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data ?? [];
    },
  });

  const members = useQuery({
    queryKey: ["contrib-member-options", coopId, memberSearch],
    enabled: Boolean(coopId),
    queryFn: async () => {
      let q = supabase
        .from("members")
        .select("id, first_name, last_name, member_number, membership_number")
        .eq("cooperative_id", coopId!)
        .order("last_name")
        .limit(25);
      if (memberSearch.trim()) {
        const t = `%${memberSearch.trim()}%`;
        q = q.or(
          `first_name.ilike.${t},last_name.ilike.${t},member_number.ilike.${t},membership_number.ilike.${t}`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const recent = useQuery({
    queryKey: ["recent-contributions", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_transactions")
        .select(
          "id, transaction_number, amount, transaction_date, status, source, payment_reference, savings_products(product_name), members(first_name, last_name, member_number)",
        )
        .eq("cooperative_id", coopId!)
        .in("transaction_type", [
          "CONTRIBUTION",
          "SPECIAL_CONTRIBUTION",
          "BANK_TRANSFER_CONTRIBUTION",
          "CASH_CONTRIBUTION",
          "CHECK_OFF_CONTRIBUTION",
        ])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const reset = () => {
    setAmount("");
    setReference("");
    setExternalRef("");
    setDescription("");
    setDuplicate(null);
  };

  const checkDuplicate = async () => {
    if (!coopId || !memberId || !amount) return null;
    const { data } = await supabase
      .from("savings_transactions")
      .select("transaction_number")
      .eq("cooperative_id", coopId)
      .eq("member_id", memberId)
      .eq("amount", Number(amount))
      .eq("value_date", valueDate)
      .limit(1);
    return data?.[0]?.transaction_number ?? null;
  };

  const record = useMutation({
    mutationFn: async (force: boolean) => {
      if (!force) {
        const dup = await checkDuplicate();
        if (dup) {
          setDuplicate(dup);
          throw new Error("__duplicate__");
        }
      }
      // find or open the member's account for this product
      const { data: existing, error: findErr } = await supabase
        .from("member_savings_accounts")
        .select("id")
        .eq("cooperative_id", coopId!)
        .eq("member_id", memberId)
        .eq("savings_product_id", productId)
        .maybeSingle();
      if (findErr) throw findErr;

      let accountId = existing?.id ?? null;
      if (!accountId) {
        const { data: number, error: numErr } = await supabase.rpc("next_savings_account_number", {
          _cooperative_id: coopId!,
          _member_id: memberId,
          _product_id: productId,
        });
        if (numErr) throw numErr;
        const { data: created, error: createErr } = await supabase
          .from("member_savings_accounts")
          .insert({
            cooperative_id: coopId!,
            member_id: memberId,
            savings_product_id: productId,
            account_number: number as string,
          })
          .select("id")
          .single();
        if (createErr) throw createErr;
        accountId = created.id;
      }

      const { data: txNumber, error: tnErr } = await supabase.rpc(
        "next_savings_transaction_number",
        { _cooperative_id: coopId! },
      );
      if (tnErr) throw tnErr;

      const direction =
        MANUAL_TRANSACTION_TYPES.find((t) => t.type === type)?.direction ?? "CREDIT";

      const { error } = await supabase.from("savings_transactions").insert({
        cooperative_id: coopId!,
        member_id: memberId,
        savings_account_id: accountId,
        savings_product_id: productId,
        period_id: periodId === "NONE" ? null : periodId,
        transaction_number: txNumber as string,
        transaction_type: type,
        direction,
        amount: Number(amount),
        transaction_date: txDate,
        value_date: valueDate,
        source,
        payment_reference: reference.trim() || null,
        external_reference: externalRef.trim() || null,
        description: description.trim() || null,
        status: "SUBMITTED",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contribution recorded and sent for checking.");
      reset();
      void qc.invalidateQueries({ queryKey: ["recent-contributions", coopId] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message === "__duplicate__") return;
      toast.error(friendlySavingsError(e));
    },
  });

  const createThisMonth = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const { error } = await supabase.from("contribution_periods").insert({
        cooperative_id: coopId!,
        name: periodNameFor(now),
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        due_date: end.toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contribution period opened.");
      void qc.invalidateQueries({ queryKey: ["contribution-periods", coopId] });
    },
    onError: (e) => toast.error(friendlySavingsError(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contributions"
        description="Record what members have paid in. Entries go through checking and approval before they affect balances."
      />

      <Tabs defaultValue="record">
        <TabsList>
          <TabsTrigger value="record">Record a contribution</TabsTrigger>
          <TabsTrigger value="split">Split a receipt</TabsTrigger>
          <TabsTrigger value="bulk">Bulk upload</TabsTrigger>
          <TabsTrigger value="recent">Recent contributions</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
        </TabsList>

        <TabsContent value="split" className="mt-4">
          {!canCreate || !coopId ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                You do not have permission to record contributions.
              </CardContent>
            </Card>
          ) : (
            <SplitReceipt
              coopId={coopId}
              products={products.data ?? []}
              periods={periods.data ?? []}
            />
          )}
        </TabsContent>

        <TabsContent value="bulk" className="mt-4">
          {!canCreate || !coopId ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                You do not have permission to record contributions.
              </CardContent>
            </Card>
          ) : (
            <BulkContributionUpload coopId={coopId} periods={periods.data ?? []} />
          )}
        </TabsContent>

        <TabsContent value="record" className="mt-4">
          {!canCreate ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                You do not have permission to record contributions.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New contribution</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Find member">
                  <Input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Name or member number"
                  />
                </Field>
                <Field label="Member">
                  <Select value={memberId} onValueChange={setMemberId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {(members.data ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.first_name} {m.last_name} — {m.member_number ?? m.membership_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Savings product">
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {(products.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.product_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Entry type">
                  <Select value={type} onValueChange={(v) => setType(v as SavingsTransactionType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MANUAL_TRANSACTION_TYPES.map((t) => (
                        <SelectItem key={t.type} value={t.type}>
                          {label(t.type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Amount (₦)">
                  <Input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setDuplicate(null);
                    }}
                  />
                </Field>
                <Field label="Source">
                  <Select value={source} onValueChange={(v) => setSource(v as SavingsSource)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCES.filter((s) => s !== "SYSTEM" && s !== "OPENING_BALANCE").map((s) => (
                        <SelectItem key={s} value={s}>
                          {label(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Transaction date">
                  <Input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
                </Field>
                <Field label="Value date">
                  <Input
                    type="date"
                    value={valueDate}
                    onChange={(e) => {
                      setValueDate(e.target.value);
                      setDuplicate(null);
                    }}
                  />
                </Field>
                <Field label="Payment reference">
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                </Field>
                <Field label="Bank / external reference">
                  <Input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
                </Field>
                <Field label="Contribution period">
                  <Select value={periodId} onValueChange={setPeriodId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Not linked to a period</SelectItem>
                      {(periods.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Description">
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                  </Field>
                </div>

                {duplicate && (
                  <div className="sm:col-span-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
                    <p className="font-medium">Possible duplicate</p>
                    <p className="text-muted-foreground">
                      Entry {duplicate} already records the same amount for this member on the same
                      value date. Record it anyway only if it is genuinely a second payment.
                    </p>
                    <Button
                      className="mt-2"
                      variant="destructive"
                      size="sm"
                      onClick={() => record.mutate(true)}
                      disabled={record.isPending}
                    >
                      Record anyway
                    </Button>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <Button
                    onClick={() => record.mutate(false)}
                    disabled={
                      record.isPending || !memberId || !productId || !amount || Number(amount) <= 0
                    }
                  >
                    {record.isPending ? "Recording…" : "Record contribution"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recent" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {recent.isPending ? (
                <p className="p-6 text-sm text-muted-foreground">Loading…</p>
              ) : (recent.data ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No contributions recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entry</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(recent.data ?? []).map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.transaction_number}</TableCell>
                          <TableCell>{formatDate(t.transaction_date)}</TableCell>
                          <TableCell>
                            {t.members?.first_name} {t.members?.last_name}
                          </TableCell>
                          <TableCell>{t.savings_products?.product_name}</TableCell>
                          <TableCell className="text-right">{formatNaira(t.amount)}</TableCell>
                          <TableCell>{label(t.source)}</TableCell>
                          <TableCell>
                            <Badge variant={transactionStatusTone(t.status)}>{label(t.status)}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="periods" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contribution periods</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => createThisMonth.mutate()}
                disabled={createThisMonth.isPending}
              >
                Open a period for this month
              </Button>
              {(periods.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No contribution periods yet.</p>
              ) : (
                (periods.data ?? []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.start_date)} – {formatDate(p.end_date)}
                        {p.due_date ? ` · due ${formatDate(p.due_date)}` : ""}
                      </p>
                    </div>
                    <Badge variant={p.status === "OPEN" ? "default" : "secondary"}>
                      {label(p.status)}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{text}</Label>
      {children}
    </div>
  );
}
