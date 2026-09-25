import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { MemberRepayments } from "@/components/loans/member-repayments";
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
import { useSession } from "@/lib/session";
import { formatDate, formatNaira } from "@/lib/format";
import {
  applicationStatusTone,
  buildSchedule,
  friendlyLoanError,
  label,
  processingFee,
} from "@/lib/loans";
import { nextApplicationNumber, recordStatusChange, type LoanProductRow } from "@/lib/loans-engine";

export const Route = createFileRoute("/portal/loans")({
  head: () => ({
    meta: [
      { title: "Loans — CoopOS Nigeria" },
      { name: "description", content: "Apply for a loan, track your application and view your repayment schedule." },
      { property: "og:title", content: "Loans — CoopOS Nigeria" },
      { property: "og:description", content: "Apply for a loan, track your application and view your repayment schedule." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalLoansPage,
});

function PortalLoansPage() {
  const { profile } = useSession();
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [tenure, setTenure] = useState("");
  const [purpose, setPurpose] = useState("");

  const me = useQuery({
    queryKey: ["portal-member", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, cooperative_id, first_name, last_name")
        .eq("user_id", profile!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const memberId = me.data?.id ?? null;
  const coopId = me.data?.cooperative_id ?? null;

  const products = useQuery({
    queryKey: ["portal-loan-products", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("*")
        .eq("cooperative_id", coopId!)
        .eq("status", "ACTIVE")
        .order("product_name");
      if (error) throw error;
      return (data ?? []) as unknown as LoanProductRow[];
    },
  });

  const applications = useQuery({
    queryKey: ["portal-loan-applications", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*, loan_products(product_name)")
        .eq("member_id", memberId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const loans = useQuery({
    queryKey: ["portal-loans", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("*, loan_products(product_name), loan_schedules(*, loan_schedule_lines(*))")
        .eq("member_id", memberId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const guarantorRequests = useQuery({
    queryKey: ["portal-guarantor-requests", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_guarantors")
        .select("*, loan_applications(application_number, requested_amount, members(first_name, last_name))")
        .eq("guarantor_member_id", memberId!)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const product = (products.data ?? []).find((p) => p.id === productId) ?? null;

  const preview = useMemo(() => {
    if (!product || !amount || !tenure) return null;
    const principal = Number(amount);
    if (!Number.isFinite(principal) || principal <= 0) return null;
    return buildSchedule({
      principal,
      annualRate: Number(product.interest_rate ?? 0),
      interestMethod: product.interest_method,
      tenure: Number(tenure),
      tenureUnit: product.tenure_unit,
      frequency: product.repayment_frequency,
      startDate: new Date(),
      fees: processingFee(product.processing_fee_type, Number(product.processing_fee_value ?? 0), principal),
      gracePeriods: product.grace_period ?? 0,
    });
  }, [product, amount, tenure]);

  const apply = useMutation({
    mutationFn: async () => {
      const number = await nextApplicationNumber(coopId!);
      const { data, error } = await supabase
        .from("loan_applications")
        .insert({
          cooperative_id: coopId!,
          application_number: number,
          member_id: memberId!,
          loan_product_id: productId,
          requested_amount: Number(amount),
          requested_tenure: Number(tenure),
          purpose: purpose.trim() || null,
          application_status: "SUBMITTED",
          submitted_at: new Date().toISOString(),
          created_by: profile?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await recordStatusChange({
        coopId: coopId!,
        applicationId: data.id,
        from: null,
        to: "SUBMITTED",
        userId: profile?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Your application has been submitted.");
      setAmount("");
      setTenure("");
      setPurpose("");
      void qc.invalidateQueries({ queryKey: ["portal-loan-applications", memberId] });
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const respond = useMutation({
    mutationFn: async (args: { id: string; accept: boolean; comment: string }) => {
      const { error } = await supabase
        .from("loan_guarantors")
        .update({
          status: args.accept ? "ACCEPTED" : "DECLINED",
          responded_at: new Date().toISOString(),
          response_comment: args.comment || null,
          offset_authorised: args.accept,
          acceptance_user: profile?.id ?? null,
          acceptance_statement: args.accept
            ? "I agree to stand as guarantor and authorise the cooperative to consider my savings in any future recovery process."
            : null,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Your response has been recorded.");
      void qc.invalidateQueries({ queryKey: ["portal-guarantor-requests", memberId] });
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  if (!me.isPending && !memberId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Loans" description="Your loan applications and repayments." />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Your account is not linked to a member record yet, so loans are not available.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Loans" description="Apply, follow your application and see what you owe." />

      <Tabs defaultValue="apply">
        <TabsList className="flex-wrap">
          <TabsTrigger value="apply">Apply</TabsTrigger>
          <TabsTrigger value="applications">My applications</TabsTrigger>
          <TabsTrigger value="loans">My loans</TabsTrigger>
          <TabsTrigger value="payments">Payments & statement</TabsTrigger>
          <TabsTrigger value="guarantor">Guarantor requests</TabsTrigger>
        </TabsList>

        <TabsContent value="apply" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New application</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-3">
                  <Label className="text-xs">Loan product</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger>
                    <SelectContent>
                      {(products.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.product_name} · {Number(p.interest_rate)}% {label(p.interest_method).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount (₦)</Label>
                  <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Tenure {product ? `(${product.minimum_tenure}–${product.maximum_tenure} ${label(product.tenure_unit).toLowerCase()})` : ""}
                  </Label>
                  <Input inputMode="numeric" value={tenure} onChange={(e) => setTenure(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Purpose</Label>
                  <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                </div>
              </div>

              {preview && (
                <div className="grid gap-3 rounded-md border p-4 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Instalment</p>
                    <p className="font-semibold tabular-nums">{formatNaira(preview.installmentAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total interest</p>
                    <p className="font-semibold tabular-nums">{formatNaira(preview.totalInterest)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total repayment</p>
                    <p className="font-semibold tabular-nums">{formatNaira(preview.totalRepayment)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Instalments</p>
                    <p className="font-semibold tabular-nums">{preview.numberOfPeriods}</p>
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-4">
                    This is an estimate using the product's published terms. The cooperative confirms the final figures.
                  </p>
                </div>
              )}

              <Button
                onClick={() => apply.mutate()}
                disabled={apply.isPending || !productId || !amount || !tenure}
              >
                {apply.isPending ? "Submitting…" : "Submit application"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {(applications.data ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">You have not applied for a loan yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Requested</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(applications.data ?? []).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.application_number}</TableCell>
                        <TableCell>{(a.loan_products as { product_name?: string } | null)?.product_name ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNaira(a.requested_amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.approved_amount ? formatNaira(a.approved_amount) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={applicationStatusTone(a.application_status)}>{label(a.application_status)}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(a.application_date)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans" className="mt-4 space-y-4">
          {(loans.data ?? []).length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">You have no loan running.</CardContent>
            </Card>
          ) : (
            (loans.data ?? []).map((l) => {
              const schedules = (l.loan_schedules as Record<string, unknown>[] | null) ?? [];
              const lines = ((schedules[0]?.["loan_schedule_lines"] as Record<string, unknown>[]) ?? []).sort(
                (a, b) => Number(a["installment_number"]) - Number(b["installment_number"]),
              );
              return (
                <Card key={l.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {l.loan_number} · {(l.loan_products as { product_name?: string } | null)?.product_name ?? ""}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Disbursed</p>
                        <p className="font-semibold tabular-nums">{formatNaira(l.disbursed_amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                        <p className="font-semibold tabular-nums">{formatNaira(l.total_outstanding)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Instalment</p>
                        <p className="font-semibold tabular-nums">{formatNaira(l.installment_amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Matures</p>
                        <p className="font-semibold">{l.maturity_date ? formatDate(l.maturity_date) : "—"}</p>
                      </div>
                    </div>
                    {lines.length > 0 && (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Due date</TableHead>
                              <TableHead className="text-right">Principal</TableHead>
                              <TableHead className="text-right">Interest</TableHead>
                              <TableHead className="text-right">Total due</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lines.map((line) => (
                              <TableRow key={String(line["id"])}>
                                <TableCell>{String(line["installment_number"])}</TableCell>
                                <TableCell>{formatDate(String(line["due_date"]))}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatNaira(line["principal"] as number)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatNaira(line["interest"] as number)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatNaira(line["total_due"] as number)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <MemberRepayments memberId={memberId} />
        </TabsContent>

        <TabsContent value="guarantor" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {(guarantorRequests.data ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nobody has asked you to stand as guarantor.</p>
              ) : (
                <ul className="divide-y">
                  {(guarantorRequests.data ?? []).map((g) => {
                    const row = g as Record<string, unknown>;
                    const a = row["loan_applications"] as
                      | { application_number?: string; requested_amount?: number; members?: { first_name?: string; last_name?: string } }
                      | null;
                    const pending = row["status"] === "PENDING";
                    return (
                      <li key={String(row["id"])} className="space-y-3 p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {[a?.members?.first_name, a?.members?.last_name].filter(Boolean).join(" ")} ·{" "}
                            {a?.application_number}
                          </span>
                          <span className="tabular-nums">{formatNaira(row["amount_guaranteed"] as number)}</span>
                          <Badge variant={row["status"] === "ACCEPTED" ? "default" : pending ? "secondary" : "destructive"}>
                            {label(String(row["status"]))}
                          </Badge>
                        </div>
                        {pending && (
                          <>
                            <p className="text-xs text-muted-foreground">
                              Accepting means you agree to stand as guarantor for this amount and allow the cooperative to
                              consider your savings in any future recovery process. No money leaves your savings today.
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                disabled={respond.isPending}
                                onClick={() => respond.mutate({ id: String(row["id"]), accept: true, comment: "" })}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={respond.isPending}
                                onClick={() => respond.mutate({ id: String(row["id"]), accept: false, comment: "" })}
                              >
                                Decline
                              </Button>
                            </div>
                          </>
                        )}
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
