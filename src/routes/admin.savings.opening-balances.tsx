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
import { friendlySavingsError, label } from "@/lib/savings";

export const Route = createFileRoute("/admin/savings/opening-balances")({
  head: () => ({
    meta: [
      { title: "Opening balances — CoopOS Nigeria" },
      { name: "description", content: "Load historical member savings balances in a controlled, auditable batch." },
      { property: "og:title", content: "Opening balances — CoopOS Nigeria" },
      { property: "og:description", content: "Load historical member savings balances in a controlled, auditable batch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OpeningBalancesPage,
});

type ParsedRow = {
  memberNumber: string;
  productCode: string;
  amount: number;
  valueDate: string;
  error?: string | undefined;
};

const TEMPLATE = "member_number,product_code,amount,value_date\nCOOP-0001,ORD,150000,2026-01-01";

function OpeningBalancesPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const canImport = hasPermission("savings.import");
  const qc = useQueryClient();

  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [csv, setCsv] = useState("");

  const batches = useQuery({
    queryKey: ["savings-batches", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_migration_batches")
        .select("*")
        .eq("cooperative_id", coopId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const lookups = useQuery({
    queryKey: ["ob-lookups", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const [m, p] = await Promise.all([
        supabase
          .from("members")
          .select("id, member_number, membership_number")
          .eq("cooperative_id", coopId!),
        supabase.from("savings_products").select("id, product_code").eq("cooperative_id", coopId!),
      ]);
      if (m.error) throw m.error;
      if (p.error) throw p.error;
      return { members: m.data ?? [], products: p.data ?? [] };
    },
  });

  const parsed = useMemo<ParsedRow[]>(() => {
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];
    const body = lines[0]!.toLowerCase().startsWith("member_number") ? lines.slice(1) : lines;
    const memberSet = new Set(
      (lookups.data?.members ?? []).flatMap((m) =>
        [m.member_number, m.membership_number].filter(Boolean) as string[],
      ),
    );
    const productSet = new Set((lookups.data?.products ?? []).map((p) => p.product_code));
    return body.map((line) => {
      const [memberNumber = "", productCode = "", amountRaw = "", valueDate = ""] = line
        .split(",")
        .map((c) => c.trim());
      const amount = Number(amountRaw);
      let error: string | undefined;
      if (!memberSet.has(memberNumber)) error = "Member number not found";
      else if (!productSet.has(productCode.toUpperCase())) error = "Product code not found";
      else if (!Number.isFinite(amount) || amount <= 0) error = "Amount must be a number above zero";
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(valueDate)) error = "Date must be in the form 2026-01-31";
      return { memberNumber, productCode: productCode.toUpperCase(), amount, valueDate, error };
    });
  }, [csv, lookups.data]);

  const valid = parsed.filter((r) => !r.error);
  const invalid = parsed.filter((r) => r.error);

  const post = useMutation({
    mutationFn: async () => {
      const { data: batch, error: batchErr } = await supabase
        .from("savings_migration_batches")
        .insert({
          cooperative_id: coopId!,
          batch_reference: reference.trim(),
          description: description.trim() || null,
          source: "CSV upload",
          status: "POSTED",
          row_count: valid.length,
          total_amount: valid.reduce((s, r) => s + r.amount, 0),
          posted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (batchErr) throw batchErr;

      const memberByNumber = new Map<string, string>();
      for (const m of lookups.data?.members ?? []) {
        if (m.member_number) memberByNumber.set(m.member_number, m.id);
        if (m.membership_number) memberByNumber.set(m.membership_number, m.id);
      }
      const productByCode = new Map(
        (lookups.data?.products ?? []).map((p) => [p.product_code, p.id] as const),
      );

      for (const row of valid) {
        const memberId = memberByNumber.get(row.memberNumber)!;
        const productId = productByCode.get(row.productCode)!;

        const { data: existing } = await supabase
          .from("member_savings_accounts")
          .select("id")
          .eq("cooperative_id", coopId!)
          .eq("member_id", memberId)
          .eq("savings_product_id", productId)
          .maybeSingle();

        let accountId = existing?.id ?? null;
        if (!accountId) {
          const { data: number, error: numErr } = await supabase.rpc(
            "next_savings_account_number",
            { _cooperative_id: coopId!, _member_id: memberId, _product_id: productId },
          );
          if (numErr) throw numErr;
          const { data: created, error: createErr } = await supabase
            .from("member_savings_accounts")
            .insert({
              cooperative_id: coopId!,
              member_id: memberId,
              savings_product_id: productId,
              account_number: number as string,
              opening_balance: row.amount,
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

        const { error: insErr } = await supabase.from("savings_transactions").insert({
          cooperative_id: coopId!,
          member_id: memberId,
          savings_account_id: accountId,
          savings_product_id: productId,
          batch_id: batch.id,
          transaction_number: txNumber as string,
          transaction_type: "OPENING_BALANCE",
          direction: "CREDIT",
          amount: row.amount,
          transaction_date: row.valueDate,
          value_date: row.valueDate,
          source: "OPENING_BALANCE",
          description: `Opening balance — batch ${reference.trim()}`,
          status: "POSTED",
        });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      toast.success("Opening balances posted.");
      setCsv("");
      setReference("");
      setDescription("");
      void qc.invalidateQueries({ queryKey: ["savings-batches", coopId] });
    },
    onError: (e) => toast.error(friendlySavingsError(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opening balances"
        description="Bring across balances members already hold. Posted opening balances can never be edited."
      />

      {!canImport ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You do not have permission to load opening balances.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New batch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Batch reference</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="OB-2026-01"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Paste the rows: member number, product code, amount, date
              </Label>
              <Textarea
                rows={8}
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder={TEMPLATE}
              />
              <Button
                variant="link"
                size="sm"
                className="px-0"
                onClick={() => setCsv(TEMPLATE)}
              >
                Use the template
              </Button>
            </div>

            {parsed.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm">
                  {valid.length} row{valid.length === 1 ? "" : "s"} ready
                  {invalid.length > 0 ? `, ${invalid.length} with problems` : ""} — total{" "}
                  {formatNaira(valid.reduce((s, r) => s + r.amount, 0))}
                </p>
                <div className="max-h-72 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member number</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Check</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.memberNumber}</TableCell>
                          <TableCell>{r.productCode}</TableCell>
                          <TableCell className="text-right">
                            {Number.isFinite(r.amount) ? formatNaira(r.amount) : "—"}
                          </TableCell>
                          <TableCell>{r.valueDate}</TableCell>
                          <TableCell>
                            {r.error ? (
                              <span className="text-destructive">{r.error}</span>
                            ) : (
                              <span className="text-muted-foreground">Ready</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <Button
              onClick={() => post.mutate()}
              disabled={
                post.isPending || !reference.trim() || valid.length === 0 || invalid.length > 0
              }
            >
              {post.isPending ? "Posting…" : `Post ${valid.length} opening balance(s)`}
            </Button>
            {invalid.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Fix the rows marked in red before posting — nothing is posted while problems remain.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Previous batches</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(batches.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No opening balance batches yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Posted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(batches.data ?? []).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.batch_reference}</TableCell>
                    <TableCell>{b.row_count}</TableCell>
                    <TableCell className="text-right">{formatNaira(b.total_amount)}</TableCell>
                    <TableCell>{b.posted_at ? formatDate(b.posted_at) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={b.status === "POSTED" ? "default" : "secondary"}>
                        {label(b.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
