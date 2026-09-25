import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
import { formatNaira } from "@/lib/format";
import { friendlySavingsError } from "@/lib/savings";
import { ensureSavingsAccount, nextTransactionNumber } from "@/lib/savings-accounts";

const TEMPLATE =
  "member_number,product_code,amount,value_date,reference\nCOOP-0001,ORD,10000,2026-09-01,SEP-PAYROLL";

type Row = {
  memberNumber: string;
  productCode: string;
  amount: number;
  valueDate: string;
  reference: string;
  error?: string | undefined;
  warning?: string | undefined;
};

export function BulkContributionUpload({
  coopId,
  periods,
}: {
  coopId: string;
  periods: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [csv, setCsv] = useState("");
  const [periodId, setPeriodId] = useState("NONE");
  const [source, setSource] = useState("BANK_TRANSFER");
  const [batchNote, setBatchNote] = useState("");

  const lookups = useQuery({
    queryKey: ["bulk-contrib-lookups", coopId],
    queryFn: async () => {
      const [m, p, t] = await Promise.all([
        supabase
          .from("members")
          .select("id, member_number, membership_number")
          .eq("cooperative_id", coopId),
        supabase
          .from("savings_products")
          .select("id, product_code")
          .eq("cooperative_id", coopId)
          .eq("status", "ACTIVE"),
        supabase
          .from("savings_transactions")
          .select("member_id, amount, value_date")
          .eq("cooperative_id", coopId)
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      if (m.error) throw m.error;
      if (p.error) throw p.error;
      if (t.error) throw t.error;
      return { members: m.data ?? [], products: p.data ?? [], existing: t.data ?? [] };
    },
  });

  const parsed = useMemo<Row[]>(() => {
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];
    const body = lines[0]!.toLowerCase().startsWith("member_number") ? lines.slice(1) : lines;

    const memberByNumber = new Map<string, string>();
    for (const m of lookups.data?.members ?? []) {
      if (m.member_number) memberByNumber.set(m.member_number, m.id);
      if (m.membership_number) memberByNumber.set(m.membership_number, m.id);
    }
    const productCodes = new Set((lookups.data?.products ?? []).map((p) => p.product_code));
    const existingKeys = new Set(
      (lookups.data?.existing ?? []).map((t) => `${t.member_id}|${Number(t.amount)}|${t.value_date}`),
    );
    const seen = new Set<string>();

    return body.map((line) => {
      const [memberNumber = "", productCodeRaw = "", amountRaw = "", valueDate = "", reference = ""] =
        line.split(",").map((c) => c.trim());
      const productCode = productCodeRaw.toUpperCase();
      const amount = Number(amountRaw);
      let error: string | undefined;
      if (!memberByNumber.has(memberNumber)) error = "Member number not found";
      else if (!productCodes.has(productCode)) error = "Product code not found";
      else if (!Number.isFinite(amount) || amount <= 0) error = "Amount must be a number above zero";
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(valueDate)) error = "Date must be in the form 2026-09-01";

      let warning: string | undefined;
      if (!error) {
        const key = `${memberByNumber.get(memberNumber)}|${amount}|${valueDate}`;
        if (seen.has(key)) warning = "Repeated twice in this file";
        else if (existingKeys.has(key)) warning = "Possible duplicate of an existing entry";
        seen.add(key);
      }
      return { memberNumber, productCode, amount, valueDate, reference, error, warning };
    });
  }, [csv, lookups.data]);

  const valid = parsed.filter((r) => !r.error);
  const invalid = parsed.filter((r) => r.error);
  const warned = parsed.filter((r) => r.warning);
  const total = valid.reduce((s, r) => s + r.amount, 0);

  const upload = useMutation({
    mutationFn: async () => {
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
        const accountId = await ensureSavingsAccount(coopId, memberId, productId);
        const txNumber = await nextTransactionNumber(coopId);
        const { error } = await supabase.from("savings_transactions").insert({
          cooperative_id: coopId,
          member_id: memberId,
          savings_account_id: accountId,
          savings_product_id: productId,
          period_id: periodId === "NONE" ? null : periodId,
          transaction_number: txNumber,
          transaction_type: "CONTRIBUTION",
          direction: "CREDIT",
          amount: row.amount,
          transaction_date: row.valueDate,
          value_date: row.valueDate,
          source: source as "BANK_TRANSFER",
          payment_reference: row.reference || null,
          description: batchNote.trim() || "Bulk contribution upload",
          status: "SUBMITTED",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${valid.length} contribution(s) uploaded and sent for checking.`);
      setCsv("");
      void qc.invalidateQueries({ queryKey: ["recent-contributions", coopId] });
      void qc.invalidateQueries({ queryKey: ["bulk-contrib-lookups", coopId] });
    },
    onError: (e) => toast.error(friendlySavingsError(e)),
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setCsv(await file.text());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload many contributions at once</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">How the money came in</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="IMPORT">Spreadsheet import</SelectItem>
                <SelectItem value="MANUAL">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contribution period</Label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Not linked to a period</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note on every row</Label>
            <Input value={batchNote} onChange={(e) => setBatchNote(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            Upload a file, or paste rows: member number, product code, amount, date, reference
          </Label>
          <Input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={TEMPLATE} />
          <Button variant="link" size="sm" className="px-0" onClick={() => setCsv(TEMPLATE)}>
            Use the template
          </Button>
        </div>

        {parsed.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm">
              {valid.length} row{valid.length === 1 ? "" : "s"} ready
              {invalid.length > 0 ? `, ${invalid.length} with problems` : ""}
              {warned.length > 0 ? `, ${warned.length} to double-check` : ""} — total{" "}
              {formatNaira(total)}
            </p>
            <div className="max-h-72 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member number</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
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
                      <TableCell>{r.reference || "—"}</TableCell>
                      <TableCell>
                        {r.error ? (
                          <span className="text-destructive">{r.error}</span>
                        ) : r.warning ? (
                          <span className="text-amber-600 dark:text-amber-500">{r.warning}</span>
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
          onClick={() => upload.mutate()}
          disabled={upload.isPending || valid.length === 0 || invalid.length > 0}
        >
          {upload.isPending ? "Uploading…" : `Upload ${valid.length} contribution(s)`}
        </Button>
        {invalid.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Fix the rows marked in red first — nothing is uploaded while problems remain.
          </p>
        )}
        {invalid.length === 0 && warned.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Rows marked in amber look like duplicates. Remove them if they are not genuine second
            payments.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Uploaded entries wait for checking and approval, so no balance changes until they are
          posted.
        </p>
      </CardContent>
    </Card>
  );
}
