import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
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
import { notifyStaff } from "@/lib/notify";
import { formatNaira, formatNumber } from "@/lib/format";
import {
  DEDUCTION_TYPES,
  PAYROLL_TEMPLATE,
  SOURCE_TYPES,
  TARGET_FIELDS,
  friendlyCheckoffError,
  label,
  parseDelimited,
  type CheckoffDeductionType,
  type TargetField,
} from "@/lib/checkoff";

export const Route = createFileRoute("/admin/checkoff/import")({
  head: () => ({
    meta: [
      { title: "Upload payroll file — CoopOS Nigeria" },
      { name: "description", content: "Upload an employer payroll file, map its columns and create a check-off batch." },
      { property: "og:title", content: "Upload payroll file — CoopOS Nigeria" },
      { property: "og:description", content: "Upload an employer payroll file, map its columns and create a check-off batch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { corrects?: string } =>
    typeof search["corrects"] === "string" ? { corrects: search["corrects"] as string } : {},
  component: CheckoffImportPage,
});

const NONE = "__none__";

function CheckoffImportPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const canUpload = hasPermission("checkoff.upload") || hasPermission("checkoff.create");
  const navigate = useNavigate();
  const { corrects } = Route.useSearch();
  const [correctionReason, setCorrectionReason] = useState("");

  const original = useQuery({
    queryKey: ["checkoff-original-batch", corrects],
    enabled: Boolean(corrects),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkoff_batches")
        .select("id, batch_number, payroll_period, checkoff_profile_id, period_id, deduction_date, total_gross_amount")
        .eq("id", corrects!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [step, setStep] = useState(1);
  const [profileId, setProfileId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [payrollPeriod, setPayrollPeriod] = useState("");
  const [payrollStart, setPayrollStart] = useState("");
  const [payrollEnd, setPayrollEnd] = useState("");
  const [deductionDate, setDeductionDate] = useState(new Date().toISOString().slice(0, 10));
  const [sourceType, setSourceType] = useState<string>("CSV");
  const [fileName, setFileName] = useState("");
  const [raw, setRaw] = useState("");
  const [mapping, setMapping] = useState<Record<TargetField, string>>({} as Record<TargetField, string>);
  const [defaultType, setDefaultType] = useState<CheckoffDeductionType>("ORDINARY_SAVINGS");

  // A corrected file reuses the original batch's employer, period and dates.
  const prefilled = useRef(false);
  useEffect(() => {
    const o = original.data;
    if (!o || prefilled.current) return;
    prefilled.current = true;
    setProfileId(o.checkoff_profile_id ?? "");
    setPeriodId(o.period_id ?? "");
    setPayrollPeriod(o.payroll_period ?? "");
    setDeductionDate(o.deduction_date ?? new Date().toISOString().slice(0, 10));
  }, [original.data]);


  const profiles = useQuery({
    queryKey: ["checkoff-active-profiles", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkoff_profiles")
        .select("*")
        .eq("cooperative_id", coopId!)
        .eq("active", true)
        .order("profile_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const periods = useQuery({
    queryKey: ["checkoff-periods", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribution_periods")
        .select("id, name, status")
        .eq("cooperative_id", coopId!)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const savedMapping = useQuery({
    queryKey: ["checkoff-mapping", profileId],
    enabled: Boolean(profileId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkoff_column_mappings")
        .select("source_column, target_field")
        .eq("checkoff_profile_id", profileId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const parsed = useMemo(() => parseDelimited(raw), [raw]);

  const autoMap = () => {
    const next = {} as Record<TargetField, string>;
    const saved = new Map((savedMapping.data ?? []).map((m) => [m.target_field, m.source_column]));
    for (const field of TARGET_FIELDS) {
      const fromSaved = saved.get(field);
      if (fromSaved && parsed.headers.includes(fromSaved)) {
        next[field] = fromSaved;
        continue;
      }
      const guess = parsed.headers.find(
        (h) => h.toLowerCase().replace(/[^a-z]/g, "") === field.replace(/_/g, ""),
      );
      if (guess) next[field] = guess;
    }
    setMapping(next);
  };

  const rows = useMemo(() => {
    const idx = (field: TargetField) => parsed.headers.indexOf(mapping[field] ?? "");
    return parsed.rows.map((cells, i) => {
      const pick = (field: TargetField) => {
        const at = idx(field);
        return at >= 0 ? (cells[at] ?? "").trim() : "";
      };
      const amountRaw = pick("deduction_amount").replace(/[₦,\s]/g, "");
      const amount = Number(amountRaw);
      const typeRaw = pick("deduction_type").toUpperCase().replace(/[\s-]/g, "_");
      const deductionType = (DEDUCTION_TYPES as string[]).includes(typeRaw)
        ? (typeRaw as CheckoffDeductionType)
        : defaultType;
      const payrollDate = pick("payroll_date");
      const problems: string[] = [];
      if (!Number.isFinite(amount)) problems.push("Amount is not a number");
      else if (amount === 0) problems.push("Amount is zero");
      else if (amount < 0) problems.push("Amount is negative");
      if (!pick("employee_id") && !pick("staff_number") && !pick("member_number") && !pick("employee_name"))
        problems.push("No way to identify the employee");
      if (payrollDate && !/^\d{4}-\d{2}-\d{2}$/.test(payrollDate))
        problems.push("Date must be like 2026-09-25");
      return {
        line_number: i + 1,
        employee_id: pick("employee_id") || null,
        staff_number: pick("staff_number") || null,
        member_number: pick("member_number") || null,
        employee_name: pick("employee_name") || null,
        department: pick("department") || null,
        deduction_type: deductionType,
        deduction_amount: Number.isFinite(amount) ? amount : 0,
        payroll_date: /^\d{4}-\d{2}-\d{2}$/.test(payrollDate) ? payrollDate : null,
        source_reference: pick("source_reference") || null,
        problems,
      };
    });
  }, [parsed, mapping, defaultType]);

  const duplicateKeys = useMemo(() => {
    const seen = new Map<string, number>();
    const dupes = new Set<number>();
    rows.forEach((r) => {
      const key = `${r.employee_id ?? ""}|${r.member_number ?? ""}|${r.deduction_type}`;
      if (key === "||" + r.deduction_type) return;
      const prev = seen.get(key);
      if (prev !== undefined) dupes.add(r.line_number);
      else seen.set(key, r.line_number);
    });
    return dupes;
  }, [rows]);

  const total = rows.reduce((s, r) => s + r.deduction_amount, 0);
  const badRows = rows.filter((r) => r.problems.length > 0);

  const create = useMutation({
    mutationFn: async () => {
      if (corrects && !correctionReason.trim())
        throw new Error("Say why this corrected file is replacing the earlier one.");
      const { data: existing } = await supabase
        .from("checkoff_batches")
        .select("id")
        .eq("cooperative_id", coopId!)
        .eq("payroll_period", payrollPeriod.trim())
        .eq("checkoff_profile_id", profileId)
        .maybeSingle();

      const { data: number, error: numErr } = await supabase.rpc("next_checkoff_batch_number", {
        _cooperative_id: coopId!,
      });
      if (numErr) throw numErr;

      const { data: batch, error: batchErr } = await supabase
        .from("checkoff_batches")
        .insert({
          cooperative_id: coopId!,
          checkoff_profile_id: profileId,
          period_id: periodId || null,
          batch_number: number as string,
          payroll_period: payrollPeriod.trim(),
          payroll_start_date: payrollStart || null,
          payroll_end_date: payrollEnd || null,
          deduction_date: deductionDate,
          file_name: fileName || null,
          source_type: sourceType as never,
          status: "UPLOADED",
          total_records: rows.length,
          total_gross_amount: total,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id ?? null,
          uploaded_at: new Date().toISOString(),
          corrects_batch_id: corrects ?? null,
          notes: corrects
            ? `Corrected file for batch ${original.data?.batch_number ?? ""}. ${correctionReason.trim()}`
            : existing
              ? "Possible duplicate: this employer already has a batch for this payroll period."
              : null,
        })
        .select("id")
        .single();
      if (batchErr) throw batchErr;

      const payload = rows.map((r) => ({
        cooperative_id: coopId!,
        batch_id: batch.id,
        line_number: r.line_number,
        employee_id: r.employee_id,
        staff_number: r.staff_number,
        member_number: r.member_number,
        employee_name: r.employee_name,
        department: r.department,
        deduction_type: r.deduction_type,
        deduction_amount: r.deduction_amount,
        payroll_date: r.payroll_date,
        source_reference: r.source_reference,
      }));
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await supabase.from("checkoff_batch_lines").insert(payload.slice(i, i + 200));
        if (error) throw error;
      }

      // Save the mapping against the employer so the next file is easier.
      const mapRows = TARGET_FIELDS.filter((f) => mapping[f]).map((f) => ({
        cooperative_id: coopId!,
        checkoff_profile_id: profileId,
        source_column: mapping[f]!,
        target_field: f,
      }));
      if (mapRows.length > 0) {
        await supabase
          .from("checkoff_column_mappings")
          .upsert(mapRows, { onConflict: "checkoff_profile_id,target_field" });
      }

      if (corrects) {
        await supabase.from("checkoff_corrections").insert({
          cooperative_id: coopId!,
          original_batch_id: corrects,
          correction_batch_id: batch.id,
          reason: correctionReason.trim(),
          difference_amount: total - Number(original.data?.total_gross_amount ?? 0),
        });
      }

      if (existing && !corrects) toast.warning("This employer already has a batch for that payroll period.");
      return batch.id as string;
    },
    onSuccess: async (id) => {
      toast.success(corrects ? "Corrected payroll file loaded." : "Payroll file loaded.");
      await notifyStaff({
        cooperativeId: coopId!,
        eventType: corrects ? "CHECKOFF_CORRECTION_UPLOADED" : "CHECKOFF_UPLOADED",
        title: corrects
          ? `Corrected payroll file loaded for ${payrollPeriod.trim()}`
          : `Payroll file loaded for ${payrollPeriod.trim()}`,
        body: `${formatNumber(rows.length)} rows · ${formatNaira(total)}. Checks and matching are the next step.`,
        link: `/admin/checkoff/${id}`,
        severity: "ACTION",
      });
      void navigate({ to: "/admin/checkoff/$batchId", params: { batchId: id } });
    },
    onError: (e) => toast.error(friendlyCheckoffError(e)),
  });

  if (!canUpload) {
    return (
      <div className="space-y-6">
        <PageHeader title="Upload payroll file" />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You do not have permission to upload payroll files.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload payroll file"
        description="Four steps: choose the employer, load the file, match the columns, then check the preview."
      />

      <div className="flex flex-wrap gap-2 text-xs">
        {["Employer & period", "File", "Columns", "Preview"].map((s, i) => (
          <span
            key={s}
            className={`rounded-full border px-3 py-1 ${step === i + 1 ? "bg-secondary font-medium" : "text-muted-foreground"}`}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>

      {corrects && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base">
              Corrected file for batch {original.data?.batch_number ?? "…"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              The earlier batch is kept exactly as it is. This file is saved as a new batch linked to it.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Why is it being corrected?</Label>
              <Textarea
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="For example: the employer sent the wrong deduction amounts for two departments."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Employer and period</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Employer / payroll source</Label>
                <Select value={profileId} onValueChange={setProfileId}>
                  <SelectTrigger><SelectValue placeholder="Choose an employer" /></SelectTrigger>
                  <SelectContent>
                    {(profiles.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.profile_name} — {p.employer_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payroll period</Label>
                <Input value={payrollPeriod} onChange={(e) => setPayrollPeriod(e.target.value)} placeholder="September 2026" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contribution period</Label>
                <Select value={periodId || NONE} onValueChange={(v) => setPeriodId(v === NONE ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not linked</SelectItem>
                    {(periods.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} · {label(p.status)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payroll start</Label>
                <Input type="date" value={payrollStart} onChange={(e) => setPayrollStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payroll end</Label>
                <Input type="date" value={payrollEnd} onChange={(e) => setPayrollEnd(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Deduction date</Label>
                <Input type="date" value={deductionDate} onChange={(e) => setDeductionDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Where it came from</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>{label(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => setStep(2)} disabled={!profileId || !payrollPeriod.trim()}>Continue</Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">The file</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Choose a CSV file</Label>
              <Input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setFileName(file.name);
                  setRaw(await file.text());
                }}
              />
              <p className="text-xs text-muted-foreground">
                Save an Excel sheet as CSV first, or paste the rows below.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Or paste the rows, first line being the column names</Label>
              <Textarea rows={8} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={PAYROLL_TEMPLATE} />
              <Button variant="link" size="sm" className="px-0" onClick={() => setRaw(PAYROLL_TEMPLATE)}>
                Use the template
              </Button>
            </div>
            {parsed.headers.length > 0 && (
              <p className="text-sm">
                {formatNumber(parsed.rows.length)} row{parsed.rows.length === 1 ? "" : "s"} read,{" "}
                {parsed.headers.length} columns.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button
                onClick={() => { autoMap(); setStep(3); }}
                disabled={parsed.rows.length === 0}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Match the columns</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TARGET_FIELDS.map((field) => (
                <div key={field} className="space-y-1.5">
                  <Label className="text-xs">
                    {label(field)}
                    {field === "deduction_amount" && " (required)"}
                  </Label>
                  <Select
                    value={mapping[field] || NONE}
                    onValueChange={(v) =>
                      setMapping((m) => ({ ...m, [field]: v === NONE ? "" : v }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Not in the file" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not in the file</SelectItem>
                      {parsed.headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label className="text-xs">Deduction type when the file does not say</Label>
                <Select value={defaultType} onValueChange={(v) => setDefaultType(v as CheckoffDeductionType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEDUCTION_TYPES.map((d) => (
                      <SelectItem key={d} value={d}>{label(d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)} disabled={!mapping["deduction_amount"]}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {formatNumber(rows.length)} rows · {formatNaira(total)} total ·{" "}
              {badRows.length} with problems · {duplicateKeys.size} possible duplicates
            </p>
            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Identifier</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Check</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 300).map((r) => (
                    <TableRow key={r.line_number}>
                      <TableCell>{r.line_number}</TableCell>
                      <TableCell>{r.employee_name ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.member_number ?? r.employee_id ?? r.staff_number ?? "—"}
                      </TableCell>
                      <TableCell>{label(r.deduction_type)}</TableCell>
                      <TableCell className="text-right">{formatNaira(r.deduction_amount)}</TableCell>
                      <TableCell className="text-xs">
                        {r.problems.length > 0 ? (
                          <span className="text-destructive">{r.problems.join("; ")}</span>
                        ) : duplicateKeys.has(r.line_number) ? (
                          <span className="text-muted-foreground">Possible duplicate</span>
                        ) : (
                          <span className="text-muted-foreground">Ready</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rows.length > 300 && (
              <p className="text-xs text-muted-foreground">Showing the first 300 rows; all rows will be loaded.</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending || rows.length === 0 || badRows.length > 0}>
                {create.isPending ? "Loading…" : `Create batch of ${rows.length} rows`}
              </Button>
            </div>
            {badRows.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Fix the rows marked in red in the file, then load it again — nothing is saved while problems remain.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
