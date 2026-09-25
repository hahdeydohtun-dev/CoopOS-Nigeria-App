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
import { formatDate } from "@/lib/format";
import { FREQUENCIES } from "@/lib/savings";
import { friendlyCheckoffError, label } from "@/lib/checkoff";

export const Route = createFileRoute("/admin/checkoff/profiles")({
  head: () => ({
    meta: [
      { title: "Employers & payroll sources — CoopOS Nigeria" },
      { name: "description", content: "Set up employers, payroll frequency, matching rules and default savings product." },
      { property: "og:title", content: "Employers & payroll sources — CoopOS Nigeria" },
      { property: "og:description", content: "Set up employers, payroll frequency, matching rules and default savings product." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoffProfilesPage,
});

function CheckoffProfilesPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const canManage = hasPermission("checkoff.manage_profiles");
  const qc = useQueryClient();

  const [form, setForm] = useState({
    profile_name: "",
    employer_name: "",
    employer_code: "",
    payroll_frequency: "MONTHLY",
    payroll_provider: "",
    file_format: "CSV",
    default_savings_product_id: "",
    auto_match_threshold: "95",
    review_threshold: "70",
    variance_tolerance: "0",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const products = useQuery({
    queryKey: ["checkoff-products", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_products")
        .select("id, product_code, product_name")
        .eq("cooperative_id", coopId!)
        .order("product_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const profiles = useQuery({
    queryKey: ["checkoff-profiles", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkoff_profiles")
        .select("*")
        .eq("cooperative_id", coopId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("checkoff_profiles").insert({
        cooperative_id: coopId!,
        profile_name: form.profile_name.trim(),
        employer_name: form.employer_name.trim(),
        employer_code: form.employer_code.trim() || null,
        payroll_frequency: form.payroll_frequency as never,
        payroll_provider: form.payroll_provider.trim() || null,
        file_format: form.file_format,
        default_savings_product_id: form.default_savings_product_id || null,
        auto_match_threshold: Number(form.auto_match_threshold),
        review_threshold: Number(form.review_threshold),
        variance_tolerance: Number(form.variance_tolerance),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employer saved.");
      setForm((f) => ({ ...f, profile_name: "", employer_name: "", employer_code: "" }));
      void qc.invalidateQueries({ queryKey: ["checkoff-profiles", coopId] });
    },
    onError: (e) => toast.error(friendlyCheckoffError(e)),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("checkoff_profiles").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["checkoff-profiles", coopId] }),
    onError: (e) => toast.error(friendlyCheckoffError(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employers & payroll sources"
        description="One entry for each employer or payroll source that sends you deductions."
      />

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add an employer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name for this source</Label>
                <Input value={form.profile_name} onChange={(e) => set("profile_name", e.target.value)} placeholder="Head office payroll" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Employer</Label>
                <Input value={form.employer_name} onChange={(e) => set("employer_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Employer code</Label>
                <Input value={form.employer_code} onChange={(e) => set("employer_code", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payroll frequency</Label>
                <Select value={form.payroll_frequency} onValueChange={(v) => set("payroll_frequency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>{label(f)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payroll provider</Label>
                <Input value={form.payroll_provider} onChange={(e) => set("payroll_provider", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">File format</Label>
                <Select value={form.file_format} onValueChange={(v) => set("file_format", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CSV">CSV</SelectItem>
                    <SelectItem value="XLSX">Excel (XLSX)</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Default savings product</Label>
                <Select
                  value={form.default_savings_product_id}
                  onValueChange={(v) => set("default_savings_product_id", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger>
                  <SelectContent>
                    {(products.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.product_code} — {p.product_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Match automatically at or above (%)</Label>
                <Input type="number" value={form.auto_match_threshold} onChange={(e) => set("auto_match_threshold", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Send for review at or above (%)</Label>
                <Input type="number" value={form.review_threshold} onChange={(e) => set("review_threshold", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Allowed difference per member (₦)</Label>
                <Input type="number" value={form.variance_tolerance} onChange={(e) => set("variance_tolerance", e.target.value)} />
              </div>
            </div>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.profile_name.trim() || !form.employer_name.trim()}
            >
              {create.isPending ? "Saving…" : "Save employer"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(profiles.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No employers set up yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Employer</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Thresholds</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(profiles.data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.profile_name}</TableCell>
                    <TableCell>{p.employer_name}</TableCell>
                    <TableCell>{label(p.payroll_frequency)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      Auto {p.auto_match_threshold}% · review {p.review_threshold}%
                    </TableCell>
                    <TableCell>{formatDate(p.effective_from)}</TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "default" : "secondary"}>
                        {p.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive.mutate({ id: p.id, active: !p.active })}
                        >
                          {p.active ? "Deactivate" : "Activate"}
                        </Button>
                      )}
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
