import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { Switch } from "@/components/ui/switch";
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
import { FREQUENCIES } from "@/lib/savings";
import {
  FEE_TYPES,
  INTEREST_METHODS,
  TENURE_UNITS,
  friendlyLoanError,
  label,
  type LoanFeeType,
  type LoanInterestMethod,
  type LoanTenureUnit,
  type RepaymentFrequency,
} from "@/lib/loans";

export const Route = createFileRoute("/admin/loans/products")({
  head: () => ({
    meta: [
      { title: "Loan products — CoopOS Nigeria" },
      { name: "description", content: "Configure loan products, rates, limits and approval rules." },
      { property: "og:title", content: "Loan products — CoopOS Nigeria" },
      { property: "og:description", content: "Configure loan products, rates, limits and approval rules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoanProductsPage,
});

type Draft = {
  id?: string;
  product_code: string;
  product_name: string;
  description: string;
  loan_category: string;
  status: string;
  minimum_amount: string;
  maximum_amount: string;
  minimum_tenure: string;
  maximum_tenure: string;
  tenure_unit: LoanTenureUnit;
  repayment_frequency: RepaymentFrequency;
  interest_method: LoanInterestMethod;
  interest_rate: string;
  interest_rate_type: string;
  processing_fee_type: LoanFeeType;
  processing_fee_value: string;
  penal_interest_rate: string;
  grace_period: string;
  minimum_membership_months: string;
  minimum_savings_months: string;
  savings_multiplier: string;
  special_savings_waiting_period: string;
  maximum_debt_to_income_ratio: string;
  maximum_installment_to_income_ratio: string;
  guarantor_required: boolean;
  minimum_guarantors: string;
  maximum_guarantors: string;
  collateral_required: boolean;
  self_guarantee_allowed: boolean;
  insurance_required: boolean;
  requires_credit_assessment: boolean;
  requires_committee_approval: boolean;
  requires_management_approval: boolean;
  pdc_required: boolean;
  standing_instruction_required: boolean;
  effective_from: string;
};

const emptyDraft: Draft = {
  product_code: "",
  product_name: "",
  description: "",
  loan_category: "NORMAL",
  status: "ACTIVE",
  minimum_amount: "0",
  maximum_amount: "",
  minimum_tenure: "1",
  maximum_tenure: "12",
  tenure_unit: "MONTHS",
  repayment_frequency: "MONTHLY",
  interest_method: "FLAT",
  interest_rate: "0",
  interest_rate_type: "PER_ANNUM",
  processing_fee_type: "NONE",
  processing_fee_value: "0",
  penal_interest_rate: "0",
  grace_period: "0",
  minimum_membership_months: "0",
  minimum_savings_months: "0",
  savings_multiplier: "",
  special_savings_waiting_period: "0",
  maximum_debt_to_income_ratio: "",
  maximum_installment_to_income_ratio: "",
  guarantor_required: false,
  minimum_guarantors: "0",
  maximum_guarantors: "3",
  collateral_required: false,
  self_guarantee_allowed: true,
  insurance_required: false,
  requires_credit_assessment: true,
  requires_committee_approval: false,
  requires_management_approval: false,
  pdc_required: false,
  standing_instruction_required: false,
  effective_from: new Date().toISOString().slice(0, 10),
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const int = (v: string) => Number(v || 0);

function LoanProductsPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const canManage = hasPermission("loans.configure");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const products = useQuery({
    queryKey: ["loan-products", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("*")
        .eq("cooperative_id", coopId!)
        .order("product_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        cooperative_id: coopId!,
        product_code: d.product_code.trim().toUpperCase(),
        product_name: d.product_name.trim(),
        description: d.description.trim() || null,
        loan_category: d.loan_category.trim() || null,
        status: d.status,
        minimum_amount: int(d.minimum_amount),
        maximum_amount: num(d.maximum_amount),
        minimum_tenure: int(d.minimum_tenure),
        maximum_tenure: int(d.maximum_tenure),
        tenure_unit: d.tenure_unit,
        repayment_frequency: d.repayment_frequency,
        interest_method: d.interest_method,
        interest_rate: int(d.interest_rate),
        interest_rate_type: d.interest_rate_type,
        processing_fee_type: d.processing_fee_type,
        processing_fee_value: int(d.processing_fee_value),
        penal_interest_rate: int(d.penal_interest_rate),
        grace_period: int(d.grace_period),
        minimum_membership_months: int(d.minimum_membership_months),
        minimum_savings_months: int(d.minimum_savings_months),
        savings_multiplier: num(d.savings_multiplier),
        special_savings_waiting_period: int(d.special_savings_waiting_period),
        maximum_debt_to_income_ratio: num(d.maximum_debt_to_income_ratio),
        maximum_installment_to_income_ratio: num(d.maximum_installment_to_income_ratio),
        guarantor_required: d.guarantor_required,
        minimum_guarantors: int(d.minimum_guarantors),
        maximum_guarantors: int(d.maximum_guarantors),
        collateral_required: d.collateral_required,
        self_guarantee_allowed: d.self_guarantee_allowed,
        insurance_required: d.insurance_required,
        requires_credit_assessment: d.requires_credit_assessment,
        requires_committee_approval: d.requires_committee_approval,
        requires_management_approval: d.requires_management_approval,
        pdc_required: d.pdc_required,
        standing_instruction_required: d.standing_instruction_required,
        effective_from: d.effective_from,
      };
      if (d.id) {
        const { error } = await supabase.from("loan_products").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loan_products").insert({ ...payload, is_sample: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Loan product saved.");
      setOpen(false);
      setDraft(emptyDraft);
      void qc.invalidateQueries({ queryKey: ["loan-products", coopId] });
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const edit = (row: Record<string, unknown>) => {
    const s = (k: string, fallback = "") =>
      row[k] === null || row[k] === undefined ? fallback : String(row[k]);
    setDraft({
      id: row["id"] as string,
      product_code: s("product_code"),
      product_name: s("product_name"),
      description: s("description"),
      loan_category: s("loan_category"),
      status: s("status", "ACTIVE"),
      minimum_amount: s("minimum_amount", "0"),
      maximum_amount: s("maximum_amount"),
      minimum_tenure: s("minimum_tenure", "1"),
      maximum_tenure: s("maximum_tenure", "12"),
      tenure_unit: row["tenure_unit"] as LoanTenureUnit,
      repayment_frequency: row["repayment_frequency"] as RepaymentFrequency,
      interest_method: row["interest_method"] as LoanInterestMethod,
      interest_rate: s("interest_rate", "0"),
      interest_rate_type: s("interest_rate_type", "PER_ANNUM"),
      processing_fee_type: row["processing_fee_type"] as LoanFeeType,
      processing_fee_value: s("processing_fee_value", "0"),
      penal_interest_rate: s("penal_interest_rate", "0"),
      grace_period: s("grace_period", "0"),
      minimum_membership_months: s("minimum_membership_months", "0"),
      minimum_savings_months: s("minimum_savings_months", "0"),
      savings_multiplier: s("savings_multiplier"),
      special_savings_waiting_period: s("special_savings_waiting_period", "0"),
      maximum_debt_to_income_ratio: s("maximum_debt_to_income_ratio"),
      maximum_installment_to_income_ratio: s("maximum_installment_to_income_ratio"),
      guarantor_required: Boolean(row["guarantor_required"]),
      minimum_guarantors: s("minimum_guarantors", "0"),
      maximum_guarantors: s("maximum_guarantors", "3"),
      collateral_required: Boolean(row["collateral_required"]),
      self_guarantee_allowed: Boolean(row["self_guarantee_allowed"]),
      insurance_required: Boolean(row["insurance_required"]),
      requires_credit_assessment: Boolean(row["requires_credit_assessment"]),
      requires_committee_approval: Boolean(row["requires_committee_approval"]),
      requires_management_approval: Boolean(row["requires_management_approval"]),
      pdc_required: Boolean(row["pdc_required"]),
      standing_instruction_required: Boolean(row["standing_instruction_required"]),
      effective_from: s("effective_from", new Date().toISOString().slice(0, 10)),
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan products"
        description="Every loan rule lives here, not in the screens. Sample products are marked and fully editable."
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setDraft(emptyDraft)}>New product</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{draft.id ? "Edit loan product" : "New loan product"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Product code">
                    <Input value={draft.product_code} onChange={(e) => setDraft({ ...draft, product_code: e.target.value })} placeholder="NORMAL" />
                  </Field>
                  <Field label="Product name">
                    <Input value={draft.product_name} onChange={(e) => setDraft({ ...draft, product_name: e.target.value })} placeholder="Normal Loan" />
                  </Field>
                  <Field label="Category">
                    <Input value={draft.loan_category} onChange={(e) => setDraft({ ...draft, loan_category: e.target.value })} />
                  </Field>
                  <Field label="Status">
                    <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Minimum amount (₦)">
                    <Input inputMode="decimal" value={draft.minimum_amount} onChange={(e) => setDraft({ ...draft, minimum_amount: e.target.value })} />
                  </Field>
                  <Field label="Maximum amount (₦)">
                    <Input inputMode="decimal" value={draft.maximum_amount} onChange={(e) => setDraft({ ...draft, maximum_amount: e.target.value })} />
                  </Field>
                  <Field label="Minimum tenure">
                    <Input inputMode="numeric" value={draft.minimum_tenure} onChange={(e) => setDraft({ ...draft, minimum_tenure: e.target.value })} />
                  </Field>
                  <Field label="Maximum tenure">
                    <Input inputMode="numeric" value={draft.maximum_tenure} onChange={(e) => setDraft({ ...draft, maximum_tenure: e.target.value })} />
                  </Field>
                  <Field label="Tenure unit">
                    <Select value={draft.tenure_unit} onValueChange={(v) => setDraft({ ...draft, tenure_unit: v as LoanTenureUnit })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TENURE_UNITS.map((t) => <SelectItem key={t} value={t}>{label(t)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Repayment frequency">
                    <Select value={draft.repayment_frequency} onValueChange={(v) => setDraft({ ...draft, repayment_frequency: v as RepaymentFrequency })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{label(f)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Interest method">
                    <Select value={draft.interest_method} onValueChange={(v) => setDraft({ ...draft, interest_method: v as LoanInterestMethod })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INTEREST_METHODS.map((m) => <SelectItem key={m} value={m}>{label(m)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Interest rate (% per annum)">
                    <Input inputMode="decimal" value={draft.interest_rate} onChange={(e) => setDraft({ ...draft, interest_rate: e.target.value })} />
                  </Field>
                  <Field label="Processing fee type">
                    <Select value={draft.processing_fee_type} onValueChange={(v) => setDraft({ ...draft, processing_fee_type: v as LoanFeeType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FEE_TYPES.map((f) => <SelectItem key={f} value={f}>{label(f)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Processing fee value">
                    <Input inputMode="decimal" value={draft.processing_fee_value} onChange={(e) => setDraft({ ...draft, processing_fee_value: e.target.value })} />
                  </Field>
                  <Field label="Penal interest rate (%)">
                    <Input inputMode="decimal" value={draft.penal_interest_rate} onChange={(e) => setDraft({ ...draft, penal_interest_rate: e.target.value })} />
                  </Field>
                  <Field label="Grace period (periods)">
                    <Input inputMode="numeric" value={draft.grace_period} onChange={(e) => setDraft({ ...draft, grace_period: e.target.value })} />
                  </Field>
                  <Field label="Minimum membership (months)">
                    <Input inputMode="numeric" value={draft.minimum_membership_months} onChange={(e) => setDraft({ ...draft, minimum_membership_months: e.target.value })} />
                  </Field>
                  <Field label="Minimum savings history (months)">
                    <Input inputMode="numeric" value={draft.minimum_savings_months} onChange={(e) => setDraft({ ...draft, minimum_savings_months: e.target.value })} />
                  </Field>
                  <Field label="Savings multiplier (x net savings)">
                    <Input inputMode="decimal" value={draft.savings_multiplier} onChange={(e) => setDraft({ ...draft, savings_multiplier: e.target.value })} />
                  </Field>
                  <Field label="Special savings waiting period (months)">
                    <Input inputMode="numeric" value={draft.special_savings_waiting_period} onChange={(e) => setDraft({ ...draft, special_savings_waiting_period: e.target.value })} />
                  </Field>
                  <Field label="Maximum debt-to-income ratio (%)">
                    <Input inputMode="decimal" value={draft.maximum_debt_to_income_ratio} onChange={(e) => setDraft({ ...draft, maximum_debt_to_income_ratio: e.target.value })} />
                  </Field>
                  <Field label="Maximum instalment-to-income ratio (%)">
                    <Input inputMode="decimal" value={draft.maximum_installment_to_income_ratio} onChange={(e) => setDraft({ ...draft, maximum_installment_to_income_ratio: e.target.value })} />
                  </Field>
                  <Field label="Minimum guarantors">
                    <Input inputMode="numeric" value={draft.minimum_guarantors} onChange={(e) => setDraft({ ...draft, minimum_guarantors: e.target.value })} />
                  </Field>
                  <Field label="Maximum guarantors">
                    <Input inputMode="numeric" value={draft.maximum_guarantors} onChange={(e) => setDraft({ ...draft, maximum_guarantors: e.target.value })} />
                  </Field>
                  <Field label="Effective from">
                    <Input type="date" value={draft.effective_from} onChange={(e) => setDraft({ ...draft, effective_from: e.target.value })} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Description">
                      <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                    </Field>
                  </div>
                  <Toggle label="Guarantors required" checked={draft.guarantor_required} onChange={(v) => setDraft({ ...draft, guarantor_required: v })} />
                  <Toggle label="Collateral required" checked={draft.collateral_required} onChange={(v) => setDraft({ ...draft, collateral_required: v })} />
                  <Toggle label="Self-guarantee allowed" checked={draft.self_guarantee_allowed} onChange={(v) => setDraft({ ...draft, self_guarantee_allowed: v })} />
                  <Toggle label="Insurance required" checked={draft.insurance_required} onChange={(v) => setDraft({ ...draft, insurance_required: v })} />
                  <Toggle label="Credit assessment required" checked={draft.requires_credit_assessment} onChange={(v) => setDraft({ ...draft, requires_credit_assessment: v })} />
                  <Toggle label="Committee approval required" checked={draft.requires_committee_approval} onChange={(v) => setDraft({ ...draft, requires_committee_approval: v })} />
                  <Toggle label="Management approval required" checked={draft.requires_management_approval} onChange={(v) => setDraft({ ...draft, requires_management_approval: v })} />
                  <Toggle label="Post-dated cheques required" checked={draft.pdc_required} onChange={(v) => setDraft({ ...draft, pdc_required: v })} />
                  <Toggle label="Standing instruction required" checked={draft.standing_instruction_required} onChange={(v) => setDraft({ ...draft, standing_instruction_required: v })} />
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => save.mutate(draft)}
                    disabled={save.isPending || !draft.product_code.trim() || !draft.product_name.trim()}
                  >
                    {save.isPending ? "Saving…" : "Save product"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      <Card>
        <CardContent className="p-0">
          {products.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading products…</p>
          ) : (products.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No loan products yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead>Tenure</TableHead>
                    <TableHead>Savings multiple</TableHead>
                    <TableHead>Guarantors</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(products.data ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.product_code}</TableCell>
                      <TableCell>
                        {p.product_name}{" "}
                        {p.is_sample && <Badge variant="outline" className="ml-1">Sample configuration</Badge>}
                      </TableCell>
                      <TableCell>
                        {Number(p.interest_rate)}% · {label(p.interest_method)}
                      </TableCell>
                      <TableCell>
                        {p.minimum_tenure}–{p.maximum_tenure} {label(p.tenure_unit).toLowerCase()}
                      </TableCell>
                      <TableCell>{p.savings_multiplier ? `${Number(p.savings_multiplier)}x` : "—"}</TableCell>
                      <TableCell>{p.guarantor_required ? `${p.minimum_guarantors} required` : "Not required"}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "ACTIVE" ? "default" : "secondary"}>{label(p.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && (
                          <Button variant="ghost" size="sm" onClick={() => edit(p as never)}>
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
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

function Toggle({
  label: text,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <Label className="text-sm">{text}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
