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
import { formatNaira } from "@/lib/format";
import {
  FREQUENCIES,
  PRODUCT_TYPES,
  friendlySavingsError,
  label,
  type ContributionFrequency,
  type SavingsProductType,
} from "@/lib/savings";

export const Route = createFileRoute("/admin/savings/products")({
  head: () => ({
    meta: [
      { title: "Savings products — CoopOS Nigeria" },
      { name: "description", content: "Create and configure the cooperative's savings products." },
      { property: "og:title", content: "Savings products — CoopOS Nigeria" },
      { property: "og:description", content: "Create and configure the cooperative's savings products." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SavingsProductsPage,
});

type Draft = {
  id?: string;
  product_code: string;
  product_name: string;
  description: string;
  product_type: SavingsProductType;
  status: string;
  minimum_contribution: string;
  maximum_contribution: string;
  contribution_frequency: ContributionFrequency;
  withdrawal_allowed: boolean;
  withdrawal_percentage_limit: string;
  withdrawal_notice_days: string;
  eligibility_wait_days: string;
  bonus_eligible: boolean;
  loan_eligibility_enabled: boolean;
  collateral_eligible: boolean;
  account_number_format: string;
  effective_from: string;
};

const emptyDraft: Draft = {
  product_code: "",
  product_name: "",
  description: "",
  product_type: "ORDINARY",
  status: "ACTIVE",
  minimum_contribution: "",
  maximum_contribution: "",
  contribution_frequency: "MONTHLY",
  withdrawal_allowed: true,
  withdrawal_percentage_limit: "",
  withdrawal_notice_days: "",
  eligibility_wait_days: "0",
  bonus_eligible: false,
  loan_eligibility_enabled: true,
  collateral_eligible: false,
  account_number_format: "{MEMBER}-{PRODUCT}",
  effective_from: new Date().toISOString().slice(0, 10),
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));

function SavingsProductsPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const canManage = hasPermission("savings.manage_products");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const products = useQuery({
    queryKey: ["savings-products", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_products")
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
        product_type: d.product_type,
        status: d.status,
        minimum_contribution: num(d.minimum_contribution),
        maximum_contribution: num(d.maximum_contribution),
        contribution_frequency: d.contribution_frequency,
        withdrawal_allowed: d.withdrawal_allowed,
        withdrawal_percentage_limit: num(d.withdrawal_percentage_limit),
        withdrawal_notice_days: num(d.withdrawal_notice_days),
        eligibility_wait_days: Number(d.eligibility_wait_days || 0),
        bonus_eligible: d.bonus_eligible,
        loan_eligibility_enabled: d.loan_eligibility_enabled,
        collateral_eligible: d.collateral_eligible,
        account_number_format: d.account_number_format.trim() || "{MEMBER}-{PRODUCT}",
        effective_from: d.effective_from,
        is_sample: false,
      };
      if (d.id) {
        const { error } = await supabase.from("savings_products").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("savings_products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Savings product saved.");
      setOpen(false);
      setDraft(emptyDraft);
      void qc.invalidateQueries({ queryKey: ["savings-products", coopId] });
    },
    onError: (e) => toast.error(friendlySavingsError(e)),
  });

  const edit = (row: Record<string, unknown>) => {
    setDraft({
      id: row["id"] as string,
      product_code: (row["product_code"] as string) ?? "",
      product_name: (row["product_name"] as string) ?? "",
      description: (row["description"] as string) ?? "",
      product_type: row["product_type"] as SavingsProductType,
      status: (row["status"] as string) ?? "ACTIVE",
      minimum_contribution: row["minimum_contribution"]?.toString() ?? "",
      maximum_contribution: row["maximum_contribution"]?.toString() ?? "",
      contribution_frequency: row["contribution_frequency"] as ContributionFrequency,
      withdrawal_allowed: Boolean(row["withdrawal_allowed"]),
      withdrawal_percentage_limit: row["withdrawal_percentage_limit"]?.toString() ?? "",
      withdrawal_notice_days: row["withdrawal_notice_days"]?.toString() ?? "",
      eligibility_wait_days: row["eligibility_wait_days"]?.toString() ?? "0",
      bonus_eligible: Boolean(row["bonus_eligible"]),
      loan_eligibility_enabled: Boolean(row["loan_eligibility_enabled"]),
      collateral_eligible: Boolean(row["collateral_eligible"]),
      account_number_format: (row["account_number_format"] as string) ?? "{MEMBER}-{PRODUCT}",
      effective_from: (row["effective_from"] as string) ?? new Date().toISOString().slice(0, 10),
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings products"
        description="Every savings rule lives here, not in the screens. Sample products are marked and fully editable."
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setDraft(emptyDraft)}>New product</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{draft.id ? "Edit savings product" : "New savings product"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Product code">
                    <Input
                      value={draft.product_code}
                      onChange={(e) => setDraft({ ...draft, product_code: e.target.value })}
                      placeholder="ORD"
                    />
                  </Field>
                  <Field label="Product name">
                    <Input
                      value={draft.product_name}
                      onChange={(e) => setDraft({ ...draft, product_name: e.target.value })}
                      placeholder="Ordinary Savings"
                    />
                  </Field>
                  <Field label="Type">
                    <Select
                      value={draft.product_type}
                      onValueChange={(v) => setDraft({ ...draft, product_type: v as SavingsProductType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {label(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Contribution frequency">
                    <Select
                      value={draft.contribution_frequency}
                      onValueChange={(v) =>
                        setDraft({ ...draft, contribution_frequency: v as ContributionFrequency })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map((f) => (
                          <SelectItem key={f} value={f}>
                            {label(f)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Minimum contribution (₦)">
                    <Input
                      inputMode="decimal"
                      value={draft.minimum_contribution}
                      onChange={(e) => setDraft({ ...draft, minimum_contribution: e.target.value })}
                    />
                  </Field>
                  <Field label="Maximum contribution (₦)">
                    <Input
                      inputMode="decimal"
                      value={draft.maximum_contribution}
                      onChange={(e) => setDraft({ ...draft, maximum_contribution: e.target.value })}
                    />
                  </Field>
                  <Field label="Withdrawal limit (% of balance)">
                    <Input
                      inputMode="decimal"
                      value={draft.withdrawal_percentage_limit}
                      onChange={(e) =>
                        setDraft({ ...draft, withdrawal_percentage_limit: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Withdrawal notice (days)">
                    <Input
                      inputMode="numeric"
                      value={draft.withdrawal_notice_days}
                      onChange={(e) => setDraft({ ...draft, withdrawal_notice_days: e.target.value })}
                    />
                  </Field>
                  <Field label="Waiting period before a contribution counts (days)">
                    <Input
                      inputMode="numeric"
                      value={draft.eligibility_wait_days}
                      onChange={(e) => setDraft({ ...draft, eligibility_wait_days: e.target.value })}
                    />
                  </Field>
                  <Field label="Account number format">
                    <Input
                      value={draft.account_number_format}
                      onChange={(e) => setDraft({ ...draft, account_number_format: e.target.value })}
                      placeholder="{MEMBER}-{PRODUCT}"
                    />
                  </Field>
                  <Field label="Effective from">
                    <Input
                      type="date"
                      value={draft.effective_from}
                      onChange={(e) => setDraft({ ...draft, effective_from: e.target.value })}
                    />
                  </Field>
                  <Field label="Status">
                    <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Description">
                      <Textarea
                        value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Toggle
                    label="Withdrawals allowed"
                    checked={draft.withdrawal_allowed}
                    onChange={(v) => setDraft({ ...draft, withdrawal_allowed: v })}
                  />
                  <Toggle
                    label="Eligible for annual bonus"
                    checked={draft.bonus_eligible}
                    onChange={(v) => setDraft({ ...draft, bonus_eligible: v })}
                  />
                  <Toggle
                    label="Counts towards loan eligibility"
                    checked={draft.loan_eligibility_enabled}
                    onChange={(v) => setDraft({ ...draft, loan_eligibility_enabled: v })}
                  />
                  <Toggle
                    label="Can be used as loan collateral"
                    checked={draft.collateral_eligible}
                    onChange={(v) => setDraft({ ...draft, collateral_eligible: v })}
                  />
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => save.mutate(draft)}
                    disabled={
                      save.isPending || !draft.product_code.trim() || !draft.product_name.trim()
                    }
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
            <p className="p-6 text-sm text-muted-foreground">No savings products yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Minimum</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Waiting period</TableHead>
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
                        {p.is_sample && (
                          <Badge variant="outline" className="ml-1">
                            Sample configuration
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{label(p.product_type)}</TableCell>
                      <TableCell>{formatNaira(p.minimum_contribution)}</TableCell>
                      <TableCell>{label(p.contribution_frequency)}</TableCell>
                      <TableCell>{p.eligibility_wait_days ? `${p.eligibility_wait_days} days` : "None"}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "ACTIVE" ? "default" : "secondary"}>
                          {label(p.status)}
                        </Badge>
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
