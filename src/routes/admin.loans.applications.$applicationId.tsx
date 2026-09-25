import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useSession, roleLabel } from "@/lib/session";
import { formatDate, formatDateTime, formatNaira } from "@/lib/format";
import { notifyMembers, notifyStaff } from "@/lib/notify";
import {
  RISK_RATINGS,
  SECURITY_TYPES,
  applicationStatusTone,
  buildSchedule,
  eligibilityTone,
  friendlyLoanError,
  label,
  processingFee,
  type LoanRiskRating,
  type LoanSecurityType,
} from "@/lib/loans";
import {
  evaluateEligibility,
  loadMemberPosition,
  nextLoanNumber,
  recordStatusChange,
  saveSchedule,
  type LoanProductRow,
} from "@/lib/loans-engine";

export const Route = createFileRoute("/admin/loans/applications/$applicationId")({
  head: () => ({
    meta: [
      { title: "Loan application — CoopOS Nigeria" },
      { name: "description", content: "Eligibility, guarantors, security, assessment and approvals for one loan application." },
      { property: "og:title", content: "Loan application — CoopOS Nigeria" },
      { property: "og:description", content: "Eligibility, guarantors, security, assessment and approvals for one loan application." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoanApplicationDetail,
});

function LoanApplicationDetail() {
  const { applicationId } = Route.useParams();
  const { cooperative, profile, hasPermission, roles, isPlatformAdmin } = useSession();
  const coopId = cooperative?.id ?? null;
  const userId = profile?.id ?? null;
  const qc = useQueryClient();

  const [approvedAmount, setApprovedAmount] = useState("");
  const [decisionReason, setDecisionReason] = useState("");

  const limits = useQuery({
    queryKey: ["loan-limits", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_approval_limits")
        .select("*")
        .eq("cooperative_id", coopId!)
        .eq("active", true)
        .order("minimum_amount");
      if (error) throw error;
      return data ?? [];
    },
  });

  const q = useQuery({
    queryKey: ["loan-application", applicationId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const [app, eligibility, guarantors, securities, assessment, schedule, history, loan] =
        await Promise.all([
          supabase
            .from("loan_applications")
            .select("*, members(first_name, last_name, member_number, phone, email), loan_products(*)")
            .eq("id", applicationId)
            .maybeSingle(),
          supabase
            .from("loan_eligibility_results")
            .select("*")
            .eq("loan_application_id", applicationId)
            .order("evaluated_at", { ascending: false })
            .limit(1),
          supabase
            .from("loan_guarantors")
            .select("*, members:guarantor_member_id(first_name, last_name, member_number)")
            .eq("loan_application_id", applicationId),
          supabase.from("loan_securities").select("*").eq("loan_application_id", applicationId),
          supabase
            .from("loan_credit_assessments")
            .select("*")
            .eq("loan_application_id", applicationId)
            .maybeSingle(),
          supabase
            .from("loan_schedules")
            .select("*, loan_schedule_lines(*)")
            .eq("loan_application_id", applicationId)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("loan_application_status_history")
            .select("*")
            .eq("loan_application_id", applicationId)
            .order("created_at", { ascending: false }),
          supabase.from("loans").select("*").eq("application_id", applicationId).maybeSingle(),
        ]);
      if (app.error) throw app.error;
      return {
        app: app.data,
        eligibility: (eligibility.data ?? [])[0] ?? null,
        guarantors: guarantors.data ?? [],
        securities: securities.data ?? [],
        assessment: assessment.data ?? null,
        schedule: (schedule.data ?? [])[0] ?? null,
        history: history.data ?? [],
        loan: loan.data ?? null,
      };
    },
  });

  const app = q.data?.app as Record<string, unknown> | null | undefined;
  const product = (app?.["loan_products"] ?? null) as LoanProductRow | null;
  const member = (app?.["members"] ?? null) as
    | { first_name?: string; last_name?: string; member_number?: string }
    | null;
  const status = app?.["application_status"] as string | undefined;
  const refresh = () => qc.invalidateQueries({ queryKey: ["loan-application", applicationId] });

  const move = useMutation({
    mutationFn: async (args: { to: string; reason?: string; patch?: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("loan_applications")
        .update({ application_status: args.to as never, ...(args.patch ?? {}) })
        .eq("id", applicationId);
      if (error) throw error;
      await recordStatusChange({
        coopId: coopId!,
        applicationId,
        from: status ?? null,
        to: args.to,
        reason: args.reason ?? null,
        userId,
      });
    },
    onSuccess: (_d, vars) => {
      toast.success(`Application moved to ${label(vars.to)}.`);
      const reason = vars.reason;
      setDecisionReason("");
      void refresh();
      void notifyStaff({
        cooperativeId: coopId!,
        eventType: "LOAN_STATUS",
        title: `Loan ${String(app?.["application_number"] ?? "")} is now ${label(vars.to)}`,
        link: `/admin/loans/applications/${applicationId}`,
        severity: vars.to === "CHECKED" || vars.to === "APPROVED" ? "ACTION" : "INFO",
      });
      const memberId = app?.["member_id"] ? String(app["member_id"]) : null;
      const reference = String(app?.["application_number"] ?? "your loan application");
      if (memberId) {
        if (vars.to === "APPROVED") {
          void notifyMembers(coopId!, [memberId], {
            eventType: "LOAN_APPROVED",
            title: "Your loan application has been approved",
            body: `${reference} is approved and waiting to be paid out.`,
          });
        } else if (vars.to === "REJECTED") {
          void notifyMembers(coopId!, [memberId], {
            eventType: "LOAN_REJECTED",
            title: "Your loan application was not approved",
            body: reason ? `${reference}: ${reason}` : reference,
          });
        } else if (vars.to === "SUBMITTED") {
          void notifyMembers(coopId!, [memberId], {
            eventType: "LOAN_SUBMITTED",
            title: "Your loan application has been submitted",
            body: `${reference} is now with the cooperative for review.`,
          });
        }
      }
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const runEligibility = useMutation({
    mutationFn: async () => {
      if (!product || !app) throw new Error("The product for this application is missing.");
      const position = await loadMemberPosition(coopId!, String(app["member_id"]));
      const outcome = evaluateEligibility({
        product,
        position,
        requestedAmount: Number(app["requested_amount"] ?? 0),
        requestedTenure: Number(app["requested_tenure"] ?? 0),
      });

      const { error } = await supabase.from("loan_eligibility_results").insert({
        cooperative_id: coopId!,
        loan_application_id: applicationId,
        evaluated_by: userId,
        status: outcome.status,
        savings_based_limit: outcome.savingsBasedLimit,
        income_based_limit: outcome.incomeBasedLimit,
        policy_based_limit: outcome.policyBasedLimit,
        binding_limit: outcome.bindingLimit,
        net_savings: position.netSavings,
        net_salary: position.netSalary,
        existing_obligations: position.existingLoanExposure,
        proposed_installment: outcome.proposedInstallment,
        debt_service_ratio: outcome.debtServiceRatio,
        membership_months: position.membershipMonths,
        contribution_months: position.contributionMonths,
        existing_loan_exposure: position.existingLoanExposure,
        guarantee_exposure: position.guaranteeExposure,
        checks: outcome.checks as never,
      });
      if (error) throw error;

      await supabase
        .from("loan_applications")
        .update({
          eligibility_status: outcome.status,
          calculated_maximum_amount: outcome.savingsBasedLimit,
          calculated_affordable_amount: outcome.incomeBasedLimit,
          calculated_credit_limit: outcome.bindingLimit,
          application_status:
            status === "SUBMITTED" || status === "DRAFT"
              ? ("ELIGIBILITY_CHECK" as never)
              : (status as never),
        })
        .eq("id", applicationId);

      await saveSchedule({
        coopId: coopId!,
        applicationId,
        schedule: outcome.schedule,
        startDate: new Date().toISOString().slice(0, 10),
      });
    },
    onSuccess: () => {
      toast.success("Eligibility checked against live member records.");
      void refresh();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const disburse = useMutation({
    mutationFn: async () => {
      if (!app || !product) throw new Error("Application not loaded.");
      const principal = Number(app["approved_amount"] ?? app["requested_amount"] ?? 0);
      const tenure = Number(app["approved_tenure"] ?? app["requested_tenure"] ?? 0);
      const fees = processingFee(
        product.processing_fee_type,
        Number(product.processing_fee_value ?? 0),
        principal,
      );
      const schedule = buildSchedule({
        principal,
        annualRate: Number(product.interest_rate ?? 0),
        interestMethod: product.interest_method,
        tenure,
        tenureUnit: product.tenure_unit,
        frequency: product.repayment_frequency,
        startDate: new Date(),
        fees,
        gracePeriods: product.grace_period ?? 0,
      });

      const loanNumber = await nextLoanNumber(coopId!);
      const lastDue = schedule.lines[schedule.lines.length - 1]?.due_date ?? null;
      const { data: loan, error } = await supabase
        .from("loans")
        .insert({
          cooperative_id: coopId!,
          loan_number: loanNumber,
          application_id: applicationId,
          member_id: String(app["member_id"]),
          loan_product_id: product.id,
          principal_amount: principal,
          approved_amount: principal,
          interest_method: product.interest_method,
          interest_rate: Number(product.interest_rate ?? 0),
          tenure,
          tenure_unit: product.tenure_unit,
          repayment_frequency: product.repayment_frequency,
          installment_amount: schedule.installmentAmount,
          start_date: new Date().toISOString().slice(0, 10),
          maturity_date: lastDue,
          status: "ACTIVE",
          disbursement_status: "DISBURSED",
          disbursed_at: new Date().toISOString(),
          disbursed_by: userId,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;

      await saveSchedule({
        coopId: coopId!,
        loanId: loan.id,
        schedule,
        startDate: new Date().toISOString().slice(0, 10),
        status: "ACTIVE",
      });

      const { error: txnErr } = await supabase.from("loan_transactions").insert({
        cooperative_id: coopId!,
        loan_id: loan.id,
        member_id: String(app["member_id"]),
        transaction_number: `${loanNumber}-D1`,
        transaction_type: "DISBURSEMENT",
        status: "POSTED",
        amount: principal,
        principal_component: principal,
        narration: `Disbursement of ${loanNumber}`,
        created_by: userId,
        approved_by: (app["approved_by"] as string | null) ?? null,
      });
      if (txnErr) throw txnErr;

      if (fees > 0) {
        await supabase.from("loan_transactions").insert({
          cooperative_id: coopId!,
          loan_id: loan.id,
          member_id: String(app["member_id"]),
          transaction_number: `${loanNumber}-F1`,
          transaction_type: "FEE_CHARGE",
          status: "POSTED",
          amount: fees,
          fee_component: fees,
          narration: "Processing fee",
          created_by: userId,
        });
      }

      await supabase
        .from("loan_applications")
        .update({ application_status: "DISBURSED" as never, disbursement_status: "DISBURSED" })
        .eq("id", applicationId);
      await recordStatusChange({
        coopId: coopId!,
        applicationId,
        from: status ?? null,
        to: "DISBURSED",
        userId,
      });
      await notifyMembers(coopId!, [String(app["member_id"])], {
        eventType: "LOAN_DISBURSED",
        title: "Your loan has been disbursed",
        body: `${loanNumber} for ${formatNaira(principal)}.`,
      });
      return loanNumber;
    },
    onSuccess: (n) => {
      toast.success(`Loan ${n} created and disbursed.`);
      void refresh();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading application…</p>;
  if (!app) return <p className="text-sm text-muted-foreground">This application was not found.</p>;

  const createdBy = app["created_by"] as string | null;
  const checkedBy = app["checked_by"] as string | null;
  const isMaker = createdBy && userId === createdBy;
  const canCheck = hasPermission("loans.check") && !isMaker;
  const canApprove = hasPermission("loans.approve") && !isMaker && userId !== checkedBy;
  const canDisburse = hasPermission("loans.disburse");

  const amountToApprove = Number(approvedAmount || app["requested_amount"] || 0);
  const band =
    (limits.data ?? []).find(
      (l) =>
        amountToApprove >= Number(l.minimum_amount ?? 0) &&
        (l.maximum_amount === null || amountToApprove <= Number(l.maximum_amount)),
    ) ?? null;
  const bandRoleMet =
    !band?.required_role || isPlatformAdmin || roles.includes(band.required_role);
  const committeeMet =
    !band?.requires_committee || isPlatformAdmin || roles.includes("COMMITTEE_MEMBER");
  const bandBlock = !band
    ? null
    : !bandRoleMet
      ? `${formatNaira(amountToApprove)} falls in the “${band.label}” band, which only ${roleLabel(band.required_role!)} may approve.`
      : !committeeMet
        ? `The “${band.label}” band also needs a committee member to approve.`
        : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={String(app["application_number"])}
        description={`${[member?.first_name, member?.last_name].filter(Boolean).join(" ")} · ${product?.product_name ?? ""}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/admin/loans/applications">Back to list</Link>
            </Button>
            <Button variant="outline" onClick={() => runEligibility.mutate()} disabled={runEligibility.isPending}>
              {runEligibility.isPending ? "Checking…" : "Run eligibility check"}
            </Button>
            {status === "DRAFT" && (
              <Button onClick={() => move.mutate({ to: "SUBMITTED" })}>Submit</Button>
            )}
            {status === "ELIGIBILITY_CHECK" && (
              <Button onClick={() => move.mutate({ to: "UNDER_REVIEW" })}>Send for review</Button>
            )}
            {status === "UNDER_REVIEW" && (
              <Button onClick={() => move.mutate({ to: "CREDIT_REVIEW" })}>Send for credit review</Button>
            )}
            {status === "CREDIT_REVIEW" && canCheck && (
              <Button
                onClick={() =>
                  move.mutate({
                    to: "CHECKED",
                    patch: { checked_by: userId, checked_at: new Date().toISOString() },
                  })
                }
              >
                Mark as checked
              </Button>
            )}
            {status === "APPROVED" && canDisburse && (
              <Button onClick={() => disburse.mutate()} disabled={disburse.isPending}>
                {disburse.isPending ? "Disbursing…" : "Disburse"}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={applicationStatusTone(status as never)}>{label(status)}</Badge>
        <Badge variant={eligibilityTone(app["eligibility_status"] as never)}>
          Eligibility: {label(app["eligibility_status"] as string)}
        </Badge>
        {q.data?.loan && <Badge variant="outline">Loan {String((q.data.loan as Record<string, unknown>)["loan_number"])}</Badge>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure title="Requested" value={formatNaira(app["requested_amount"] as number)} />
        <Figure
          title="Eligible (binding limit)"
          value={app["calculated_credit_limit"] ? formatNaira(app["calculated_credit_limit"] as number) : "Not checked"}
        />
        <Figure
          title="Recommended"
          value={app["recommended_amount"] ? formatNaira(app["recommended_amount"] as number) : "—"}
        />
        <Figure
          title="Approved"
          value={app["approved_amount"] ? formatNaira(app["approved_amount"] as number) : "—"}
        />
      </div>

      <Tabs defaultValue="eligibility">
        <TabsList className="flex-wrap">
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
          <TabsTrigger value="guarantors">Guarantors</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="assessment">Credit assessment</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="decision">Decision</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="eligibility" className="mt-4">
          <EligibilityTab result={q.data?.eligibility as Record<string, unknown> | null} />
        </TabsContent>

        <TabsContent value="guarantors" className="mt-4">
          <GuarantorsTab
            coopId={coopId!}
            applicationId={applicationId}
            rows={q.data?.guarantors ?? []}
            onChange={refresh}
            canManage={hasPermission("loans.manage_guarantors") || hasPermission("loans.create")}
          />
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <SecurityTab
            coopId={coopId!}
            applicationId={applicationId}
            rows={q.data?.securities ?? []}
            onChange={refresh}
            canManage={hasPermission("loans.manage_security") || hasPermission("loans.create")}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab
            coopId={coopId!}
            memberId={String(app["member_id"])}
            reference={String(app["application_number"])}
            canUpload={hasPermission("loans.create") || hasPermission("loans.manage_security")}
          />
        </TabsContent>


        <TabsContent value="assessment" className="mt-4">
          <AssessmentTab
            coopId={coopId!}
            applicationId={applicationId}
            existing={q.data?.assessment as Record<string, unknown> | null}
            eligibility={q.data?.eligibility as Record<string, unknown> | null}
            canAssess={hasPermission("loans.assess")}
            userId={userId}
            onChange={refresh}
          />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <ScheduleTab schedule={q.data?.schedule as Record<string, unknown> | null} />
        </TabsContent>

        <TabsContent value="decision" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The person who raised this application cannot check it, and the checker cannot approve it.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount to approve (₦)</Label>
                  <Input
                    inputMode="decimal"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    placeholder={String(app["requested_amount"] ?? "")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reason / comment</Label>
                  <Textarea value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} />
                </div>
              </div>
              {band && (
                <p className="text-sm text-muted-foreground">
                  {formatNaira(amountToApprove)} falls in the “{band.label}” band
                  {band.required_role ? `, approved by ${roleLabel(band.required_role)}` : ""}
                  {band.requires_committee ? " with a committee member" : ""}.
                </p>
              )}
              {bandBlock && <p className="text-sm text-destructive">{bandBlock}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={status !== "CHECKED" || !canApprove || Boolean(bandBlock) || move.isPending}
                  onClick={() =>
                    move.mutate({
                      to: "APPROVED",
                      reason: decisionReason,
                      patch: {
                        approved_amount: amountToApprove,
                        approved_tenure: app["requested_tenure"],
                        approved_by: userId,
                        approved_at: new Date().toISOString(),
                        approval_status: "APPROVED",
                        notes: band ? `Approved under the ${band.label} band.` : (app["notes"] as string | null) ?? null,
                      },
                    })
                  }
                >
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  disabled={!decisionReason.trim() || move.isPending}
                  onClick={() =>
                    move.mutate({
                      to: "REJECTED",
                      reason: decisionReason,
                      patch: {
                        rejected_at: new Date().toISOString(),
                        rejection_reason: decisionReason,
                        approval_status: "REJECTED",
                      },
                    })
                  }
                >
                  Reject
                </Button>
                <Button
                  variant="outline"
                  disabled={!decisionReason.trim() || move.isPending}
                  onClick={() => move.mutate({ to: "UNDER_REVIEW", reason: decisionReason })}
                >
                  Return for correction
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {(q.data?.history ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No movement recorded yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {(q.data?.history ?? []).map((h) => {
                    const row = h as Record<string, unknown>;
                    return (
                      <li key={String(row["id"])} className="flex flex-wrap justify-between gap-2 p-4">
                        <span>
                          {label(String(row["from_status"] ?? "New"))} → {label(String(row["to_status"]))}
                        </span>
                        {row["reason"] ? (
                          <span className="text-muted-foreground">{String(row["reason"])}</span>
                        ) : null}
                        <span className="text-muted-foreground">{formatDateTime(String(row["created_at"]))}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Figure({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function EligibilityTab({ result }: { result: Record<string, unknown> | null }) {
  if (!result)
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No eligibility check has been run yet. Use “Run eligibility check” above.
        </CardContent>
      </Card>
    );
  const checks = (result["checks"] as { name: string; passed: boolean; detail: string }[]) ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure title="Net savings" value={formatNaira(result["net_savings"] as number)} />
        <Figure title="Net salary" value={formatNaira(result["net_salary"] as number)} />
        <Figure title="Existing loans" value={formatNaira(result["existing_loan_exposure"] as number)} />
        <Figure title="Guarantee exposure" value={formatNaira(result["guarantee_exposure"] as number)} />
        <Figure title="Savings-based limit" value={result["savings_based_limit"] ? formatNaira(result["savings_based_limit"] as number) : "—"} />
        <Figure title="Income-based limit" value={result["income_based_limit"] ? formatNaira(result["income_based_limit"] as number) : "—"} />
        <Figure title="Policy limit" value={result["policy_based_limit"] ? formatNaira(result["policy_based_limit"] as number) : "—"} />
        <Figure title="Proposed instalment" value={formatNaira(result["proposed_installment"] as number)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {checks.map((c) => (
            <div key={c.name} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <span className="font-medium">{c.name}</span>
              <span className="text-muted-foreground">{c.detail}</span>
              <Badge variant={c.passed ? "default" : "destructive"}>{c.passed ? "Met" : "Not met"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function GuarantorsTab({
  coopId,
  applicationId,
  rows,
  onChange,
  canManage,
}: {
  coopId: string;
  applicationId: string;
  rows: unknown[];
  onChange: () => void;
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");

  const members = useQuery({
    queryKey: ["guarantor-search", coopId, query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const term = `%${query.trim()}%`;
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name, member_number")
        .eq("cooperative_id", coopId)
        .or(`first_name.ilike.${term},last_name.ilike.${term},member_number.ilike.${term}`)
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("loan_guarantors").insert({
        cooperative_id: coopId,
        loan_application_id: applicationId,
        guarantor_member_id: memberId,
        amount_guaranteed: Number(amount || 0),
      });
      if (error) throw error;
    },
    onSuccess: (_d, _v, _c) => {
      toast.success("Guarantor request recorded.");
      void notifyMembers(coopId, [memberId], {
        eventType: "LOAN_GUARANTOR_REQUEST",
        title: "You have been asked to stand as a guarantor",
        body: "Open your loans page to accept or decline the request.",
      });
      setMemberId("");
      setAmount("");
      setQuery("");
      onChange();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request a guarantor</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Member</Label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or member number" />
              {(members.data ?? []).length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {(members.data ?? []).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-accent ${memberId === m.id ? "bg-accent" : ""}`}
                      onClick={() => {
                        setMemberId(m.id);
                        setQuery(`${m.first_name} ${m.last_name}`);
                      }}
                    >
                      {m.first_name} {m.last_name} · {m.member_number ?? "—"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount guaranteed (₦)</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Button className="mt-2 w-full" disabled={!memberId || add.isPending} onClick={() => add.mutate()}>
                Add guarantor
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No guarantor has been requested.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guarantor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const row = r as Record<string, unknown>;
                  const m = row["members"] as { first_name?: string; last_name?: string; member_number?: string } | null;
                  return (
                    <TableRow key={String(row["id"])}>
                      <TableCell>
                        {[m?.first_name, m?.last_name].filter(Boolean).join(" ")}
                        <span className="block text-xs text-muted-foreground">{m?.member_number ?? ""}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(row["amount_guaranteed"] as number)}</TableCell>
                      <TableCell>
                        <Badge variant={row["status"] === "ACCEPTED" ? "default" : row["status"] === "DECLINED" ? "destructive" : "secondary"}>
                          {label(String(row["status"]))}
                        </Badge>
                      </TableCell>
                      <TableCell>{row["responded_at"] ? formatDateTime(String(row["responded_at"])) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SecurityTab({
  coopId,
  applicationId,
  rows,
  onChange,
  canManage,
}: {
  coopId: string;
  applicationId: string;
  rows: unknown[];
  onChange: () => void;
  canManage: boolean;
}) {
  const [type, setType] = useState<LoanSecurityType>("SAVINGS");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [haircut, setHaircut] = useState("0");

  const add = useMutation({
    mutationFn: async () => {
      const v = Number(value || 0);
      const h = Number(haircut || 0);
      const { error } = await supabase.from("loan_securities").insert({
        cooperative_id: coopId,
        loan_application_id: applicationId,
        security_type: type,
        description: description.trim() || null,
        value: v,
        haircut_percentage: h,
        eligible_value: Math.max(0, v - (v * h) / 100),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Security recorded.");
      setDescription("");
      setValue("");
      onChange();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add security</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as LoanSecurityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECURITY_TYPES.map((t) => <SelectItem key={t} value={t}>{label(t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Value (₦)</Label>
              <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Haircut (%)</Label>
              <Input inputMode="decimal" value={haircut} onChange={(e) => setHaircut(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              <Button className="mt-2 w-full" disabled={add.isPending || !value} onClick={() => add.mutate()}>
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No security recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Eligible value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const row = r as Record<string, unknown>;
                  return (
                    <TableRow key={String(row["id"])}>
                      <TableCell>{label(String(row["security_type"]))}</TableCell>
                      <TableCell>{(row["description"] as string) ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(row["value"] as number)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(row["eligible_value"] as number)}</TableCell>
                      <TableCell><Badge variant="outline">{label(String(row["status"]))}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AssessmentTab({
  coopId,
  applicationId,
  existing,
  eligibility,
  canAssess,
  userId,
  onChange,
}: {
  coopId: string;
  applicationId: string;
  existing: Record<string, unknown> | null;
  eligibility: Record<string, unknown> | null;
  canAssess: boolean;
  userId: string | null;
  onChange: () => void;
}) {
  const [rating, setRating] = useState<LoanRiskRating>((existing?.["risk_rating"] as LoanRiskRating) ?? "MODERATE");
  const [recommendation, setRecommendation] = useState(String(existing?.["analyst_recommendation"] ?? ""));
  const [recommended, setRecommended] = useState(String(existing?.["recommended_amount"] ?? ""));
  const [comments, setComments] = useState(String(existing?.["analyst_comments"] ?? ""));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        cooperative_id: coopId,
        loan_application_id: applicationId,
        savings_position: (eligibility?.["net_savings"] as number) ?? null,
        credit_limit: (eligibility?.["binding_limit"] as number) ?? null,
        affordable_amount: (eligibility?.["income_based_limit"] as number) ?? null,
        debt_service_ratio: (eligibility?.["debt_service_ratio"] as number) ?? null,
        risk_rating: rating,
        analyst_recommendation: recommendation.trim() || null,
        recommended_amount: recommended ? Number(recommended) : null,
        analyst_comments: comments.trim() || null,
        assessment_status: "COMPLETED" as const,
        assessed_by: userId,
        assessed_at: new Date().toISOString(),
      };
      if (existing?.["id"]) {
        const { error } = await supabase
          .from("loan_credit_assessments")
          .update(payload)
          .eq("id", String(existing["id"]));
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loan_credit_assessments").insert(payload);
        if (error) throw error;
      }
      if (recommended) {
        await supabase
          .from("loan_applications")
          .update({ recommended_amount: Number(recommended), credit_status: "ASSESSED" })
          .eq("id", applicationId);
      }
    },
    onSuccess: () => {
      toast.success("Credit assessment saved.");
      void notifyStaff({
        cooperativeId: coopId,
        eventType: "LOAN_ASSESSED",
        title: "A loan application has been assessed",
        body: `Internal risk rating: ${label(rating)}.`,
        link: `/admin/loans/applications/${applicationId}`,
        severity: "ACTION",
      });
      onChange();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Credit assessment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The risk rating is the cooperative's own internal view, not a credit bureau score.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Internal risk rating</Label>
            <Select value={rating} onValueChange={(v) => setRating(v as LoanRiskRating)} disabled={!canAssess}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RISK_RATINGS.map((r) => <SelectItem key={r} value={r}>{label(r)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Recommended amount (₦)</Label>
            <Input inputMode="decimal" value={recommended} onChange={(e) => setRecommended(e.target.value)} disabled={!canAssess} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Recommendation</Label>
            <Input value={recommendation} onChange={(e) => setRecommendation(e.target.value)} disabled={!canAssess} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Comments</Label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} disabled={!canAssess} />
          </div>
        </div>
        {canAssess && (
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save assessment"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleTab({ schedule }: { schedule: Record<string, unknown> | null }) {
  if (!schedule)
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No schedule yet. Run the eligibility check to project one.
        </CardContent>
      </Card>
    );
  const lines = ((schedule["loan_schedule_lines"] as Record<string, unknown>[]) ?? []).sort(
    (a, b) => Number(a["installment_number"]) - Number(b["installment_number"]),
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure title="Principal" value={formatNaira(schedule["principal"] as number)} />
        <Figure title="Total interest" value={formatNaira(schedule["total_interest"] as number)} />
        <Figure title="Total repayment" value={formatNaira(schedule["total_repayment"] as number)} />
        <Figure title="Instalment" value={formatNaira(schedule["installment_amount"] as number)} />
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="text-right">Total due</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={String(l["id"])}>
                  <TableCell>{String(l["installment_number"])}</TableCell>
                  <TableCell>{formatDate(String(l["due_date"]))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNaira(l["principal"] as number)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNaira(l["interest"] as number)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNaira(l["fees"] as number)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNaira(l["total_due"] as number)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNaira(l["closing_principal"] as number)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentsTab({
  coopId,
  memberId,
  reference,
  canUpload,
}: {
  coopId: string;
  memberId: string;
  reference: string;
  canUpload: boolean;
}) {
  const [documentType, setDocumentType] = useState("LOAN_APPLICATION");
  const qc = useQueryClient();

  const docs = useQuery({
    queryKey: ["loan-documents", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_documents")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const path = `${coopId}/${memberId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const { error: upErr } = await supabase.storage
        .from("member-documents")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("member_documents").insert({
        cooperative_id: coopId,
        member_id: memberId,
        document_type: documentType,
        file_name: `${reference} — ${file.name}`,
        file_size: file.size,
        mime_type: file.type || null,
        storage_path: path,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document uploaded.");
      void qc.invalidateQueries({ queryKey: ["loan-documents", memberId] });
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const open = useMutation({
    mutationFn: async (path: string) => {
      const { data, error } = await supabase.storage
        .from("member-documents")
        .createSignedUrl(path, 120);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener");
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  return (
    <div className="space-y-4">
      {canUpload && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload a supporting document</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Document type</Label>
              <Input value={documentType} onChange={(e) => setDocumentType(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">File</Label>
              <Input
                type="file"
                disabled={upload.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate(file);
                  e.target.value = "";
                }}
              />
              <p className="text-xs text-muted-foreground">
                Files are kept with the member's private records.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-0">
          {docs.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : (docs.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No document on file for this member.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(docs.data ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.file_name}</TableCell>
                    <TableCell>{label(d.document_type)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{label(d.status)}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(d.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => open.mutate(d.storage_path)}>
                        Open
                      </Button>
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
