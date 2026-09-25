import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  APPLICATION_PIPELINE,
  CLOSED_APPLICATION_STATUSES,
  applicationStatusTone,
  downloadCsv,
  friendlyLoanError,
  label,
} from "@/lib/loans";
import { nextApplicationNumber, recordStatusChange } from "@/lib/loans-engine";

export const Route = createFileRoute("/admin/loans/applications")({
  head: () => ({
    meta: [
      { title: "Loan applications — CoopOS Nigeria" },
      { name: "description", content: "Every loan application, its stage and its decision trail." },
      { property: "og:title", content: "Loan applications — CoopOS Nigeria" },
      { property: "og:description", content: "Every loan application, its stage and its decision trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoanApplicationsPage,
});

const ALL_STATUSES = [...APPLICATION_PIPELINE, ...CLOSED_APPLICATION_STATUSES];

function LoanApplicationsPage() {
  const { cooperative, profile, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const canCreate = hasPermission("loans.create");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [open, setOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberId, setMemberId] = useState("");
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [tenure, setTenure] = useState("");
  const [purpose, setPurpose] = useState("");

  const applications = useQuery({
    queryKey: ["loan-applications", coopId, status],
    enabled: Boolean(coopId),
    queryFn: async () => {
      let query = supabase
        .from("loan_applications")
        .select(
          "id, application_number, requested_amount, approved_amount, requested_tenure, application_status, eligibility_status, application_date, members(first_name, last_name, member_number), loan_products(product_name)",
        )
        .eq("cooperative_id", coopId!)
        .order("created_at", { ascending: false })
        .limit(300);
      if (status !== "ALL") query = query.eq("application_status", status as never);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const products = useQuery({
    queryKey: ["loan-products-active", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("id, product_name, minimum_tenure, maximum_tenure")
        .eq("cooperative_id", coopId!)
        .eq("status", "ACTIVE")
        .order("product_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const members = useQuery({
    queryKey: ["loan-member-search", coopId, memberQuery],
    enabled: Boolean(coopId) && memberQuery.trim().length >= 2,
    queryFn: async () => {
      const term = `%${memberQuery.trim()}%`;
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name, member_number")
        .eq("cooperative_id", coopId!)
        .or(`first_name.ilike.${term},last_name.ilike.${term},member_number.ilike.${term}`)
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const number = await nextApplicationNumber(coopId!);
      const { data, error } = await supabase
        .from("loan_applications")
        .insert({
          cooperative_id: coopId!,
          application_number: number,
          member_id: memberId,
          loan_product_id: productId,
          requested_amount: Number(amount),
          requested_tenure: Number(tenure),
          purpose: purpose.trim() || null,
          application_status: "DRAFT",
          created_by: profile?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await recordStatusChange({
        coopId: coopId!,
        applicationId: data.id,
        from: null,
        to: "DRAFT",
        userId: profile?.id ?? null,
      });
      return data.id;
    },
    onSuccess: () => {
      toast.success("Application created as a draft.");
      setOpen(false);
      setMemberId("");
      setAmount("");
      setTenure("");
      setPurpose("");
      void qc.invalidateQueries({ queryKey: ["loan-applications", coopId] });
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = applications.data ?? [];
    if (!term) return list;
    return list.filter((a) => {
      const m = a.members as { first_name?: string; last_name?: string; member_number?: string } | null;
      return [a.application_number, m?.first_name, m?.last_name, m?.member_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [applications.data, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan applications"
        description="Requested, eligible, recommended and approved amounts stay visible side by side."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "loan-applications.csv",
                  rows.map((a) => {
                    const m = a.members as { first_name?: string; last_name?: string; member_number?: string } | null;
                    return {
                      application: a.application_number,
                      member: [m?.first_name, m?.last_name].filter(Boolean).join(" "),
                      member_number: m?.member_number ?? "",
                      requested: a.requested_amount,
                      approved: a.approved_amount ?? "",
                      status: a.application_status,
                      eligibility: a.eligibility_status,
                      date: a.application_date,
                    };
                  }),
                )
              }
              disabled={rows.length === 0}
            >
              Export
            </Button>
            {canCreate && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>New application</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle>New loan application</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Find the member</Label>
                      <Input
                        value={memberQuery}
                        onChange={(e) => setMemberQuery(e.target.value)}
                        placeholder="Name or member number"
                      />
                      {(members.data ?? []).length > 0 && (
                        <div className="max-h-40 overflow-y-auto rounded-md border">
                          {(members.data ?? []).map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setMemberId(m.id);
                                setMemberQuery(`${m.first_name} ${m.last_name} (${m.member_number ?? ""})`);
                              }}
                              className={`block w-full px-3 py-2 text-left text-sm hover:bg-accent ${
                                memberId === m.id ? "bg-accent" : ""
                              }`}
                            >
                              {m.first_name} {m.last_name} · {m.member_number ?? "—"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Loan product</Label>
                      <Select value={productId} onValueChange={setProductId}>
                        <SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger>
                        <SelectContent>
                          {(products.data ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Amount requested (₦)</Label>
                        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tenure</Label>
                        <Input inputMode="numeric" value={tenure} onChange={(e) => setTenure(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Purpose</Label>
                      <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => create.mutate()}
                      disabled={create.isPending || !memberId || !productId || !amount || !tenure}
                    >
                      {create.isPending ? "Creating…" : "Create draft"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by application or member"
          className="max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="max-w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All stages</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{label(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {applications.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading applications…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No application matches this view.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead>Eligibility</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((a) => {
                    const m = a.members as { first_name?: string; last_name?: string; member_number?: string } | null;
                    const p = a.loan_products as { product_name?: string } | null;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          <Link
                            to="/admin/loans/applications/$applicationId"
                            params={{ applicationId: a.id }}
                            className="underline-offset-2 hover:underline"
                          >
                            {a.application_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {[m?.first_name, m?.last_name].filter(Boolean).join(" ") || "—"}
                          <span className="block text-xs text-muted-foreground">{m?.member_number ?? ""}</span>
                        </TableCell>
                        <TableCell>{p?.product_name ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNaira(a.requested_amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.approved_amount ? formatNaira(a.approved_amount) : "—"}
                        </TableCell>
                        <TableCell>{label(a.eligibility_status)}</TableCell>
                        <TableCell>
                          <Badge variant={applicationStatusTone(a.application_status)}>
                            {label(a.application_status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(a.application_date)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
