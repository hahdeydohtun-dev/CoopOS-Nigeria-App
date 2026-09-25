import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, ListChecks, PiggyBank, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { notifyMembers, notifyStaff } from "@/lib/notify";
import { formatDate, formatNaira, formatNumber } from "@/lib/format";
import { ensureSavingsAccount, nextTransactionNumber } from "@/lib/savings-accounts";
import {
  SAVINGS_DEDUCTION_TYPES,
  batchStatusTone,
  complianceFor,
  downloadCsv,
  friendlyCheckoffError,
  label,
  matchPayrollRow,
  matchTone,
  toCsv,
  type CheckoffDeductionType,
} from "@/lib/checkoff";

export const Route = createFileRoute("/admin/checkoff/$batchId")({
  head: () => ({
    meta: [
      { title: "Check-off batch — CoopOS Nigeria" },
      { name: "description", content: "Match members, resolve exceptions, approve and post a payroll deduction batch." },
      { property: "og:title", content: "Check-off batch — CoopOS Nigeria" },
      { property: "og:description", content: "Match members, resolve exceptions, approve and post a payroll deduction batch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoffBatchPage,
});

function CheckoffBatchPage() {
  const { batchId } = Route.useParams();
  const { cooperative, hasPermission, user } = useSession();
  const coopId = cooperative?.id ?? null;
  const qc = useQueryClient();
  const [reversalReason, setReversalReason] = useState("");

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["checkoff-batch", batchId] });
    void qc.invalidateQueries({ queryKey: ["checkoff-lines", batchId] });
    void qc.invalidateQueries({ queryKey: ["checkoff-batch-exceptions", batchId] });
    void qc.invalidateQueries({ queryKey: ["checkoff-batches", coopId] });
  };

  const batch = useQuery({
    queryKey: ["checkoff-batch", batchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkoff_batches")
        .select("*, checkoff_profiles(profile_name, employer_name, default_savings_product_id, auto_match_threshold, review_threshold, variance_tolerance)")
        .eq("id", batchId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const lines = useQuery({
    queryKey: ["checkoff-lines", batchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkoff_batch_lines")
        .select("*, members(first_name, last_name, member_number)")
        .eq("batch_id", batchId)
        .order("line_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const exceptions = useQuery({
    queryKey: ["checkoff-batch-exceptions", batchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkoff_exceptions")
        .select("*")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const settlements = useQuery({
    queryKey: ["checkoff-settlements", batchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkoff_settlements")
        .select("*")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const products = useQuery({
    queryKey: ["checkoff-products", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_products")
        .select("id, product_code, product_name, product_type")
        .eq("cooperative_id", coopId!)
        .order("product_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const memberOptions = useQuery({
    queryKey: ["checkoff-members", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, member_number, membership_number, staff_number, first_name, last_name, other_names, phone, email, lifecycle_status")
        .eq("cooperative_id", coopId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = lines.data ?? [];
  const totals = useMemo(() => {
    const gross = rows.reduce((s, r) => s + Number(r.deduction_amount), 0);
    const matched = rows.filter((r) => r.matched_member_id).reduce((s, r) => s + Number(r.deduction_amount), 0);
    const posted = rows.filter((r) => r.posting_status === "POSTED").reduce((s, r) => s + Number(r.deduction_amount), 0);
    return { gross, matched, unmatched: gross - matched, posted, unreconciled: gross - posted };
  }, [rows]);

  const status = batch.data?.status;
  const canMatch = hasPermission("checkoff.match");
  const canValidate = hasPermission("checkoff.validate");
  const canCheck = hasPermission("checkoff.check");
  const canApprove = hasPermission("checkoff.approve");
  const canPost = hasPermission("checkoff.post");
  const canReverse = hasPermission("checkoff.reverse");
  const canResolve = hasPermission("checkoff.resolve_exceptions");

  /* ------------------------------------------------------- validate + match */
  const validateAndMatch = useMutation({
    mutationFn: async () => {
      const members = memberOptions.data ?? [];
      const { data: employment } = await supabase
        .from("member_employment")
        .select("member_id, employee_id, department, employment_status")
        .eq("cooperative_id", coopId!);
      const { data: schedules } = await supabase
        .from("member_contribution_schedules")
        .select("member_id, savings_product_id, expected_amount, status")
        .eq("cooperative_id", coopId!)
        .eq("status", "ACTIVE");

      const profile = batch.data?.checkoff_profiles;
      const thresholds = {
        auto: Number(profile?.auto_match_threshold ?? 95),
        review: Number(profile?.review_threshold ?? 70),
      };
      const tolerance = Number(profile?.variance_tolerance ?? 0);
      const defaultProduct = profile?.default_savings_product_id ?? null;
      const productList = products.data ?? [];
      const specialProduct =
        productList.find((p) => p.product_type === "SPECIAL")?.id ?? defaultProduct;

      const newExceptions: Record<string, unknown>[] = [];

      for (const line of rows) {
        const result = matchPayrollRow(
          {
            employee_id: line.employee_id,
            staff_number: line.staff_number,
            member_number: line.member_number,
            employee_name: line.employee_name,
          },
          members,
          employment ?? [],
          thresholds,
        );

        const isSavings = SAVINGS_DEDUCTION_TYPES.includes(line.deduction_type as CheckoffDeductionType);
        const productId = !isSavings
          ? null
          : line.deduction_type === "SPECIAL_SAVINGS"
            ? specialProduct
            : defaultProduct;

        const member = members.find((m) => m.id === result.memberId);
        const expected =
          result.memberId && productId
            ? (schedules ?? []).find(
                (s) => s.member_id === result.memberId && s.savings_product_id === productId,
              )?.expected_amount ?? null
            : null;
        const actual = Number(line.deduction_amount);
        const expectedNum = expected === null ? null : Number(expected);
        const variance = expectedNum === null ? 0 : actual - expectedNum;

        await supabase
          .from("checkoff_batch_lines")
          .update({
            matched_member_id: result.memberId,
            match_status: result.status,
            match_confidence: result.confidence,
            match_basis: result.basis,
            savings_product_id: productId,
            expected_amount: expectedNum,
            variance_amount: variance,
            compliance_status: complianceFor(expectedNum, actual),
            posting_status: isSavings ? "PENDING" : "DEFERRED",
            exception_status:
              result.status === "UNMATCHED" || result.status === "MULTIPLE_MATCHES" ? "OPEN" : "NONE",
          })
          .eq("id", line.id);

        if (result.ambiguous) {
          newExceptions.push({
            cooperative_id: coopId!,
            batch_id: batchId,
            batch_line_id: line.id,
            exception_type: "DUPLICATE_IDENTIFIER",
            severity: "CRITICAL",
            message: `Row ${line.line_number}: more than one member shares this identifier (${result.basis}).`,
            suggested_action: "Fix the duplicated member record, then match this row by hand.",
          });
        } else if (!result.memberId) {
          newExceptions.push({
            cooperative_id: coopId!,
            batch_id: batchId,
            batch_line_id: line.id,
            exception_type: "UNMATCHED_MEMBER",
            severity: "HIGH",
            message: `Row ${line.line_number}: no member found for ${line.employee_name ?? line.employee_id ?? "this row"}.`,
            suggested_action: "Match the row to a member by hand, or ask the employer to confirm the identifier.",
          });
        } else if (member && member.lifecycle_status !== "ACTIVE") {
          newExceptions.push({
            cooperative_id: coopId!,
            batch_id: batchId,
            batch_line_id: line.id,
            exception_type: "INACTIVE_MEMBER",
            severity: "HIGH",
            message: `Row ${line.line_number}: ${member.first_name} ${member.last_name} is ${label(member.lifecycle_status)}.`,
            suggested_action: "Confirm whether the deduction should still be collected.",
          });
        } else if (expectedNum !== null && Math.abs(variance) > tolerance) {
          newExceptions.push({
            cooperative_id: coopId!,
            batch_id: batchId,
            batch_line_id: line.id,
            exception_type: "AMOUNT_VARIANCE",
            severity: "MEDIUM",
            message: `Row ${line.line_number}: deducted ${formatNaira(actual)} against an expected ${formatNaira(expectedNum)}.`,
            suggested_action: "Check the member's schedule or the employer's figure.",
          });
        }

        if (!isSavings) {
          newExceptions.push({
            cooperative_id: coopId!,
            batch_id: batchId,
            batch_line_id: line.id,
            exception_type: "NON_SAVINGS_DEDUCTION",
            severity: "LOW",
            message: `Row ${line.line_number}: ${label(line.deduction_type)} is held aside — it is not a savings deduction.`,
            suggested_action: "It will be picked up when that module is built.",
          });
        }
      }

      // Replace unresolved machine-raised exceptions for a clean re-run.
      await supabase.from("checkoff_exceptions").delete().eq("batch_id", batchId).eq("resolved", false);
      if (newExceptions.length > 0) {
        const { error } = await supabase.from("checkoff_exceptions").insert(newExceptions as never);
        if (error) throw error;
      }

      const { data: fresh } = await supabase
        .from("checkoff_batch_lines")
        .select("deduction_amount, matched_member_id")
        .eq("batch_id", batchId);
      const gross = (fresh ?? []).reduce((s, r) => s + Number(r.deduction_amount), 0);
      const matchedAmount = (fresh ?? [])
        .filter((r) => r.matched_member_id)
        .reduce((s, r) => s + Number(r.deduction_amount), 0);

      const critical = newExceptions.some((e) => e["severity"] === "CRITICAL" || e["severity"] === "HIGH");
      const { error: bErr } = await supabase
        .from("checkoff_batches")
        .update({
          status: critical ? "EXCEPTION_REVIEW" : "VALIDATION_COMPLETE",
          total_records: (fresh ?? []).length,
          total_gross_amount: gross,
          total_matched_amount: matchedAmount,
          total_unmatched_amount: gross - matchedAmount,
          reviewed_by: user?.id ?? null,
        })
        .eq("id", batchId);
      if (bErr) throw bErr;
    },
    onSuccess: async () => {
      toast.success("Rows checked and matched.");
      const open = (exceptions.data ?? []).length;
      await notifyStaff({
        cooperativeId: coopId!,
        eventType: "CHECKOFF_VALIDATED",
        title: `Checks finished on batch ${batch.data?.batch_number ?? ""}`,
        body: open > 0 ? "Some rows need attention in the exception centre." : "All rows passed the checks.",
        link: `/admin/checkoff/${batchId}`,
        severity: open > 0 ? "WARNING" : "INFO",
      });
      invalidate();
    },
    onError: (e) => toast.error(friendlyCheckoffError(e)),
  });

  const setStatus = useMutation({
    mutationFn: async (next: string) => {
      const patch: Record<string, string | null> = { status: next };
      if (next === "CHECKED") patch["checked_by"] = user?.id ?? null;
      if (next === "APPROVED") {
        if (batch.data?.uploaded_by && batch.data.uploaded_by === user?.id)
          throw new Error("You uploaded this batch, so someone else must approve it.");
        patch["approved_by"] = user?.id ?? null;
        patch["approved_at"] = new Date().toISOString();
      }
      const { error } = await supabase.from("checkoff_batches").update(patch as never).eq("id", batchId);
      if (error) throw error;
      return next;
    },
    onSuccess: async (next) => {
      toast.success("Batch updated.");
      const number = batch.data?.batch_number ?? "";
      if (next === "READY_FOR_APPROVAL") {
        await notifyStaff({
          cooperativeId: coopId!,
          eventType: "CHECKOFF_READY_FOR_APPROVAL",
          title: `Batch ${number} is ready for approval`,
          body: "A checker and approver are needed before it can be posted.",
          link: `/admin/checkoff/${batchId}`,
          severity: "ACTION",
        });
      }
      if (next === "APPROVED") {
        await notifyStaff({
          cooperativeId: coopId!,
          eventType: "CHECKOFF_APPROVED",
          title: `Batch ${number} was approved`,
          body: "It can now be posted into savings.",
          link: `/admin/checkoff/${batchId}`,
          severity: "ACTION",
        });
      }
      invalidate();
    },
    onError: (e) => toast.error(friendlyCheckoffError(e)),
  });

  /* ------------------------------------------------------------------ post */
  const post = useMutation({
    mutationFn: async () => {
      const postable = rows.filter(
        (r) =>
          r.posting_status === "PENDING" &&
          r.matched_member_id &&
          r.savings_product_id &&
          SAVINGS_DEDUCTION_TYPES.includes(r.deduction_type as CheckoffDeductionType),
      );
      if (postable.length === 0) throw new Error("No rows are ready to post.");

      let postedAmount = 0;
      for (const line of postable) {
        const accountId = await ensureSavingsAccount(
          coopId!,
          line.matched_member_id!,
          line.savings_product_id!,
        );
        const txNumber = await nextTransactionNumber(coopId!);
        const valueDate = line.payroll_date ?? batch.data!.deduction_date;

        const { data: tx, error: txErr } = await supabase
          .from("savings_transactions")
          .insert({
            cooperative_id: coopId!,
            member_id: line.matched_member_id!,
            savings_account_id: accountId,
            savings_product_id: line.savings_product_id!,
            period_id: batch.data!.period_id,
            transaction_number: txNumber,
            transaction_type: "CHECK_OFF_CONTRIBUTION",
            direction: "CREDIT",
            amount: Number(line.deduction_amount),
            transaction_date: valueDate,
            value_date: valueDate,
            source: "CHECK_OFF",
            payment_reference: batch.data!.batch_number,
            external_reference: line.source_reference,
            description: `Check-off ${batch.data!.payroll_period}`,
            status: "POSTED",
            posted_by: user?.id ?? null,
          })
          .select("id")
          .single();
        if (txErr) throw txErr;

        const { data: alloc } = await supabase
          .from("contribution_allocations")
          .insert({
            cooperative_id: coopId!,
            member_id: line.matched_member_id!,
            savings_product_id: line.savings_product_id!,
            savings_transaction_id: tx.id,
            period_id: batch.data!.period_id,
            amount: Number(line.deduction_amount),
            receipt_reference: batch.data!.batch_number,
            allocation_period: batch.data!.payroll_period,
            status: "POSTED",
          })
          .select("id")
          .maybeSingle();

        await supabase
          .from("checkoff_batch_lines")
          .update({
            posting_status: "POSTED",
            allocation_status: "ALLOCATED",
            savings_transaction_id: tx.id,
            allocation_id: alloc?.id ?? null,
            matched_savings_account_id: accountId,
          })
          .eq("id", line.id);

        postedAmount += Number(line.deduction_amount);
      }

      const remaining = rows.filter(
        (r) => r.posting_status === "PENDING" && !postable.some((p) => p.id === r.id),
      ).length;
      const unapplied = totals.gross - (Number(batch.data!.total_posted_amount ?? 0) + postedAmount);

      const { error } = await supabase
        .from("checkoff_batches")
        .update({
          status: remaining > 0 ? "PARTIALLY_POSTED" : "POSTED",
          total_posted_amount: Number(batch.data!.total_posted_amount ?? 0) + postedAmount,
          unapplied_amount: unapplied,
          posted_by: user?.id ?? null,
          posted_at: new Date().toISOString(),
        })
        .eq("id", batchId);
      if (error) throw error;
      return {
        amount: postedAmount,
        memberIds: postable.map((r) => r.matched_member_id!).filter(Boolean),
      };
    },
    onSuccess: async ({ amount, memberIds }) => {
      toast.success(`Posted ${formatNaira(amount)} into savings.`);
      const number = batch.data?.batch_number ?? "";
      const period = batch.data?.payroll_period ?? "";
      await Promise.all([
        notifyStaff({
          cooperativeId: coopId!,
          eventType: "CHECKOFF_POSTED",
          title: `Batch ${number} posted into savings`,
          body: `${formatNaira(amount)} was credited to member savings.`,
          link: `/admin/checkoff/${batchId}`,
        }),
        notifyMembers(coopId!, memberIds, {
          eventType: "CHECKOFF_POSTED",
          title: "Salary deduction credited",
          body: `Your ${period} salary deduction has been credited to your savings.`,
        }),
      ]);
      invalidate();
    },
    onError: (e) => toast.error(friendlyCheckoffError(e)),
  });

  /* -------------------------------------------------------------- reversal */
  const reverse = useMutation({
    mutationFn: async () => {
      if (!reversalReason.trim()) throw new Error("Give a reason for the reversal.");
      const posted = rows.filter((r) => r.posting_status === "POSTED" && r.savings_transaction_id);
      for (const line of posted) {
        const txNumber = await nextTransactionNumber(coopId!);
        const valueDate = line.payroll_date ?? batch.data!.deduction_date;
        const { data: tx, error: txErr } = await supabase
          .from("savings_transactions")
          .insert({
            cooperative_id: coopId!,
            member_id: line.matched_member_id!,
            savings_account_id: line.matched_savings_account_id!,
            savings_product_id: line.savings_product_id!,
            transaction_number: txNumber,
            transaction_type: "REVERSAL",
            direction: "DEBIT",
            amount: Number(line.deduction_amount),
            transaction_date: new Date().toISOString().slice(0, 10),
            value_date: valueDate,
            source: "CHECK_OFF",
            payment_reference: batch.data!.batch_number,
            description: `Reversal of check-off ${batch.data!.payroll_period}`,
            status: "POSTED",
            reversal_of_transaction_id: line.savings_transaction_id,
            reversal_reason: reversalReason.trim(),
            posted_by: user?.id ?? null,
          })
          .select("id")
          .single();
        if (txErr) throw txErr;

        await supabase
          .from("checkoff_batch_lines")
          .update({ posting_status: "REVERSED" })
          .eq("id", line.id);

        await supabase.from("checkoff_reversals").insert({
          cooperative_id: coopId!,
          batch_id: batchId,
          batch_line_id: line.id,
          reason: reversalReason.trim(),
          reversed_amount: Number(line.deduction_amount),
        });
        void tx;
      }
      const { error } = await supabase
        .from("checkoff_batches")
        .update({
          status: "REVERSED",
          reversed_by: user?.id ?? null,
          reversed_at: new Date().toISOString(),
          reversal_reason: reversalReason.trim(),
        })
        .eq("id", batchId);
      if (error) throw error;
      return posted.map((r) => r.matched_member_id!).filter(Boolean);
    },
    onSuccess: async (memberIds) => {
      toast.success("Batch reversed. The original records were kept.");
      const number = batch.data?.batch_number ?? "";
      const period = batch.data?.payroll_period ?? "";
      await Promise.all([
        notifyStaff({
          cooperativeId: coopId!,
          eventType: "CHECKOFF_REVERSED",
          title: `Batch ${number} was reversed`,
          body: reversalReason.trim(),
          link: `/admin/checkoff/${batchId}`,
          severity: "WARNING",
        }),
        notifyMembers(coopId!, memberIds, {
          eventType: "CHECKOFF_REVERSED",
          title: "Salary deduction reversed",
          body: `Your ${period} salary deduction was reversed. Please contact the cooperative office if you have questions.`,
        }),
      ]);
      setReversalReason("");
      invalidate();
    },
    onError: (e) => toast.error(friendlyCheckoffError(e)),
  });

  const manualMatch = useMutation({
    mutationFn: async ({ lineId, memberId, reason }: { lineId: string; memberId: string; reason: string }) => {
      if (!reason.trim()) throw new Error("Give a reason for matching this row by hand.");
      const { error } = await supabase
        .from("checkoff_batch_lines")
        .update({
          matched_member_id: memberId,
          match_status: "MANUAL_MATCH",
          match_confidence: 100,
          match_basis: "Matched by hand",
          manual_match_reason: reason.trim(),
          matched_by: user?.id ?? null,
          matched_at: new Date().toISOString(),
          exception_status: "RESOLVED",
        })
        .eq("id", lineId);
      if (error) throw error;
      await supabase
        .from("checkoff_exceptions")
        .update({ resolved: true, resolution: reason.trim(), resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
        .eq("batch_line_id", lineId)
        .eq("resolved", false);
    },
    onSuccess: () => {
      toast.success("Row matched.");
      invalidate();
    },
    onError: (e) => toast.error(friendlyCheckoffError(e)),
  });

  const resolveException = useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) => {
      if (!resolution.trim()) throw new Error("Say how it was resolved.");
      const { error } = await supabase
        .from("checkoff_exceptions")
        .update({
          resolved: true,
          resolution: resolution.trim(),
          resolved_by: user?.id ?? null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exception resolved.");
      invalidate();
    },
    onError: (e) => toast.error(friendlyCheckoffError(e)),
  });

  const addSettlement = useMutation({
    mutationFn: async (form: { expected: string; actual: string; date: string; reference: string; account: string }) => {
      const expected = Number(form.expected || 0);
      const actual = Number(form.actual || 0);
      const { error } = await supabase.from("checkoff_settlements").insert({
        cooperative_id: coopId!,
        batch_id: batchId,
        expected_amount: expected,
        actual_amount: actual,
        actual_settlement_date: form.date || null,
        bank_reference: form.reference || null,
        bank_account: form.account || null,
        variance: actual - expected,
        status: actual === 0 ? "EXPECTED" : actual === expected ? "RECEIVED" : actual < expected ? "PARTIALLY_RECEIVED" : "VARIANCE",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settlement recorded.");
      void qc.invalidateQueries({ queryKey: ["checkoff-settlements", batchId] });
    },
    onError: (e) => toast.error(friendlyCheckoffError(e)),
  });

  if (batch.isPending) {
    return <p className="p-6 text-sm text-muted-foreground">Loading the batch…</p>;
  }
  if (!batch.data) {
    return <p className="p-6 text-sm text-muted-foreground">That batch could not be found.</p>;
  }

  const b = batch.data;
  const openExceptions = (exceptions.data ?? []).filter((e) => !e.resolved);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Batch ${b.batch_number}`}
        description={`${b.checkoff_profiles?.employer_name ?? "Employer"} · ${b.payroll_period} · deducted ${formatDate(b.deduction_date)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={batchStatusTone(b.status)}>{label(b.status)}</Badge>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/checkoff">All batches</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Rows" value={formatNumber(rows.length)} icon={ListChecks} />
        <StatCard label="Payroll total" value={formatNaira(totals.gross)} icon={Banknote} />
        <StatCard label="Matched" value={formatNaira(totals.matched)} hint={`${formatNaira(totals.unmatched)} unmatched`} icon={Users} />
        <StatCard label="Posted to savings" value={formatNaira(totals.posted)} hint={`${formatNaira(totals.unreconciled)} not yet posted`} icon={PiggyBank} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">What happens next</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(status === "UPLOADED" || status === "DRAFT" || status === "VALIDATION_COMPLETE" || status === "EXCEPTION_REVIEW") && canValidate && (
            <Button onClick={() => validateAndMatch.mutate()} disabled={validateAndMatch.isPending}>
              {validateAndMatch.isPending ? "Checking rows…" : "Check rows and match members"}
            </Button>
          )}
          {(status === "VALIDATION_COMPLETE" || status === "EXCEPTION_REVIEW") && canValidate && (
            <Button
              variant="outline"
              onClick={() => setStatus.mutate("READY_FOR_APPROVAL")}
              disabled={openExceptions.some((e) => e.severity === "CRITICAL")}
            >
              Send for approval
            </Button>
          )}
          {status === "READY_FOR_APPROVAL" && canCheck && (
            <Button onClick={() => setStatus.mutate("CHECKED")}>Mark as checked</Button>
          )}
          {status === "CHECKED" && canApprove && (
            <Button onClick={() => setStatus.mutate("APPROVED")}>Approve</Button>
          )}
          {(status === "APPROVED" || status === "PARTIALLY_POSTED") && canPost && (
            <Button onClick={() => post.mutate()} disabled={post.isPending}>
              {post.isPending ? "Posting…" : "Post to savings"}
            </Button>
          )}
          {(status === "POSTED" || status === "PARTIALLY_POSTED") && (
            <Button variant="outline" onClick={() => setStatus.mutate("CLOSED")}>Close batch</Button>
          )}
          {canValidate && (
            <Button variant="outline" asChild>
              <Link to="/admin/checkoff/import" search={{ corrects: batchId }}>
                Upload corrected file
              </Link>
            </Button>
          )}
          {openExceptions.some((e) => e.severity === "CRITICAL") && (
            <p className="w-full text-xs text-destructive">
              A critical exception must be resolved before this batch can move on.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">Rows</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions ({openExceptions.length})</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `checkoff-${b.batch_number}.csv`,
                  toCsv([
                    ["Row", "Employee", "Identifier", "Type", "Amount", "Expected", "Difference", "Match", "Posting"],
                    ...rows.map((r) => [
                      r.line_number,
                      r.employee_name,
                      r.member_number ?? r.employee_id ?? r.staff_number,
                      r.deduction_type,
                      r.deduction_amount,
                      r.expected_amount,
                      r.variance_amount,
                      r.match_status,
                      r.posting_status,
                    ]),
                  ]),
                )
              }
            >
              Export rows
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[36rem] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>Posting</TableHead>
                      <TableHead>Member</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.line_number}</TableCell>
                        <TableCell>
                          <div className="font-medium">{r.employee_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.member_number ?? r.employee_id ?? r.staff_number ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell>{label(r.deduction_type)}</TableCell>
                        <TableCell className="text-right">{formatNaira(r.deduction_amount)}</TableCell>
                        <TableCell className="text-right">{formatNaira(r.expected_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={matchTone(r.match_status)}>{label(r.match_status)}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{label(r.posting_status)}</TableCell>
                        <TableCell>
                          {r.members ? (
                            <span className="text-xs">
                              {r.members.first_name} {r.members.last_name}
                            </span>
                          ) : canMatch && r.posting_status !== "POSTED" ? (
                            <ManualMatch
                              members={memberOptions.data ?? []}
                              onMatch={(memberId, reason) => manualMatch.mutate({ lineId: r.id, memberId, reason })}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exceptions" className="space-y-4 pt-4">
          {(exceptions.data ?? []).length === 0 ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No exceptions on this batch.</CardContent></Card>
          ) : (
            (exceptions.data ?? []).map((e) => (
              <ExceptionCard
                key={e.id}
                severity={e.severity}
                type={e.exception_type}
                message={e.message}
                suggestion={e.suggested_action}
                resolved={e.resolved}
                resolution={e.resolution}
                canResolve={canResolve}
                onResolve={(resolution) => resolveException.mutate({ id: e.id, resolution })}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="settlement" className="space-y-4 pt-4">
          <SettlementForm
            defaultExpected={String(totals.gross)}
            onSubmit={(form) => addSettlement.mutate(form)}
            pending={addSettlement.isPending}
          />
          <Card>
            <CardHeader><CardTitle className="text-base">Money received from the employer</CardTitle></CardHeader>
            <CardContent className="p-0">
              {(settlements.data ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nothing recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(settlements.data ?? []).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{formatDate(s.actual_settlement_date)}</TableCell>
                        <TableCell className="text-right">{formatNaira(s.expected_amount)}</TableCell>
                        <TableCell className="text-right">{formatNaira(s.actual_amount)}</TableCell>
                        <TableCell className="text-right">{formatNaira(s.variance)}</TableCell>
                        <TableCell>{s.bank_reference ?? "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{label(s.status)}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Where the money stands</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Line label="Payroll file total" value={totals.gross} />
              <Line label="Matched to members" value={totals.matched} />
              <Line label="Not matched" value={totals.unmatched} />
              <Line label="Posted into savings" value={totals.posted} />
              <Line label="Still to apply" value={totals.gross - totals.posted} />
            </CardContent>
          </Card>
          {(status === "POSTED" || status === "PARTIALLY_POSTED") && canReverse && (
            <Card>
              <CardHeader><CardTitle className="text-base">Reverse this batch</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  The original entries stay in place; a matching reversal is written against each one.
                </p>
                <Textarea
                  rows={3}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Why is this being reversed?"
                />
                <Button variant="destructive" onClick={() => reverse.mutate()} disabled={reverse.isPending}>
                  {reverse.isPending ? "Reversing…" : "Reverse batch"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Line({ label: text, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="text-muted-foreground">{text}</span>
      <span className="font-medium">{formatNaira(value)}</span>
    </div>
  );
}

function ManualMatch({
  members,
  onMatch,
}: {
  members: { id: string; first_name: string; last_name: string; member_number: string | null }[];
  onMatch: (memberId: string, reason: string) => void;
}) {
  const [memberId, setMemberId] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-1">
      <Select value={memberId} onValueChange={setMemberId}>
        <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Pick a member" /></SelectTrigger>
        <SelectContent>
          {members.slice(0, 300).map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.first_name} {m.last_name} {m.member_number ? `· ${m.member_number}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input className="h-8 w-44 text-xs" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button size="sm" variant="outline" className="h-7" disabled={!memberId || !reason.trim()} onClick={() => onMatch(memberId, reason)}>
        Match
      </Button>
    </div>
  );
}

function ExceptionCard({
  severity,
  type,
  message,
  suggestion,
  resolved,
  resolution,
  canResolve,
  onResolve,
}: {
  severity: string;
  type: string;
  message: string;
  suggestion: string | null;
  resolved: boolean;
  resolution: string | null;
  canResolve: boolean;
  onResolve: (resolution: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={severity === "CRITICAL" || severity === "HIGH" ? "destructive" : "secondary"}>
            {label(severity)}
          </Badge>
          <span className="text-xs text-muted-foreground">{label(type)}</span>
          {resolved && <Badge variant="outline">Resolved</Badge>}
        </div>
        <p className="text-sm">{message}</p>
        {suggestion && <p className="text-xs text-muted-foreground">{suggestion}</p>}
        {resolved ? (
          resolution && <p className="text-xs text-muted-foreground">Resolution: {resolution}</p>
        ) : canResolve ? (
          <div className="flex gap-2">
            <Input className="h-8 text-xs" placeholder="How was it resolved?" value={text} onChange={(e) => setText(e.target.value)} />
            <Button size="sm" variant="outline" disabled={!text.trim()} onClick={() => onResolve(text)}>
              Resolve
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SettlementForm({
  defaultExpected,
  onSubmit,
  pending,
}: {
  defaultExpected: string;
  onSubmit: (form: { expected: string; actual: string; date: string; reference: string; account: string }) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    expected: defaultExpected,
    actual: "",
    date: "",
    reference: "",
    account: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Record money received</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Expected (₦)</Label>
            <Input type="number" value={form.expected} onChange={(e) => set("expected", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Received (₦)</Label>
            <Input type="number" value={form.actual} onChange={(e) => set("actual", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date received</Label>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bank reference</Label>
            <Input value={form.reference} onChange={(e) => set("reference", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bank account</Label>
            <Input value={form.account} onChange={(e) => set("account", e.target.value)} />
          </div>
        </div>
        <Button onClick={() => onSubmit(form)} disabled={pending || !form.actual}>
          {pending ? "Saving…" : "Record settlement"}
        </Button>
      </CardContent>
    </Card>
  );
}
