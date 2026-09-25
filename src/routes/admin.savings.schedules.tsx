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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDate, formatNaira } from "@/lib/format";
import {
  FREQUENCIES,
  friendlySavingsError,
  label,
  type ContributionFrequency,
} from "@/lib/savings";

export const Route = createFileRoute("/admin/savings/schedules")({
  head: () => ({
    meta: [
      { title: "Contribution schedules — CoopOS Nigeria" },
      { name: "description", content: "What each member is expected to contribute, by category or individually." },
      { property: "og:title", content: "Contribution schedules — CoopOS Nigeria" },
      { property: "og:description", content: "What each member is expected to contribute, by category or individually." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchedulesPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function SchedulesPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const canManage = hasPermission("savings.manage_schedules");
  const qc = useQueryClient();

  const products = useQuery({
    queryKey: ["savings-products", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_products")
        .select("id, product_name")
        .eq("cooperative_id", coopId!)
        .order("product_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const categories = useQuery({
    queryKey: ["membership-categories", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_categories")
        .select("id, name")
        .eq("cooperative_id", coopId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const defaults = useQuery({
    queryKey: ["category-defaults", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_contribution_defaults")
        .select(
          "id, expected_amount, frequency, due_day, effective_from, effective_to, membership_categories(name), savings_products(product_name)",
        )
        .eq("cooperative_id", coopId!)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const schedules = useQuery({
    queryKey: ["member-schedules", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_contribution_schedules")
        .select(
          "id, expected_amount, frequency, due_day, effective_from, effective_to, status, reason_for_change, members(first_name, last_name, member_number), savings_products(product_name)",
        )
        .eq("cooperative_id", coopId!)
        .order("effective_from", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  // category default form
  const [catId, setCatId] = useState("");
  const [catProduct, setCatProduct] = useState("");
  const [catAmount, setCatAmount] = useState("");
  const [catFreq, setCatFreq] = useState<ContributionFrequency>("MONTHLY");
  const [catFrom, setCatFrom] = useState(today());

  const saveDefault = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("category_contribution_defaults").insert({
        cooperative_id: coopId!,
        category_id: catId,
        savings_product_id: catProduct,
        expected_amount: Number(catAmount),
        frequency: catFreq,
        effective_from: catFrom,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category default saved.");
      setCatAmount("");
      void qc.invalidateQueries({ queryKey: ["category-defaults", coopId] });
    },
    onError: (e) => toast.error(friendlySavingsError(e)),
  });

  // member schedule form
  const [memberSearch, setMemberSearch] = useState("");
  const [memberId, setMemberId] = useState("");
  const [schProduct, setSchProduct] = useState("");
  const [schAmount, setSchAmount] = useState("");
  const [schFreq, setSchFreq] = useState<ContributionFrequency>("MONTHLY");
  const [schFrom, setSchFrom] = useState(today());
  const [schReason, setSchReason] = useState("");

  const members = useQuery({
    queryKey: ["schedule-member-options", coopId, memberSearch],
    enabled: Boolean(coopId),
    queryFn: async () => {
      let q = supabase
        .from("members")
        .select("id, first_name, last_name, member_number, membership_number")
        .eq("cooperative_id", coopId!)
        .order("last_name")
        .limit(25);
      if (memberSearch.trim()) {
        const t = `%${memberSearch.trim()}%`;
        q = q.or(
          `first_name.ilike.${t},last_name.ilike.${t},member_number.ilike.${t},membership_number.ilike.${t}`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveSchedule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("member_contribution_schedules").insert({
        cooperative_id: coopId!,
        member_id: memberId,
        savings_product_id: schProduct,
        expected_amount: Number(schAmount),
        frequency: schFreq,
        effective_from: schFrom,
        reason_for_change: schReason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member schedule saved.");
      setSchAmount("");
      setSchReason("");
      void qc.invalidateQueries({ queryKey: ["member-schedules", coopId] });
    },
    onError: (e) => toast.error(friendlySavingsError(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contribution schedules"
        description="Set what members are expected to contribute. Earlier schedules are kept, so history is never rewritten."
      />

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Member schedules</TabsTrigger>
          <TabsTrigger value="categories">Category defaults</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4 space-y-4">
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New or revised member schedule</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Find member">
                  <Input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
                </Field>
                <Field label="Member">
                  <Select value={memberId} onValueChange={setMemberId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {(members.data ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.first_name} {m.last_name} — {m.member_number ?? m.membership_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Savings product">
                  <Select value={schProduct} onValueChange={setSchProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {(products.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.product_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Expected amount (₦)">
                  <Input
                    inputMode="decimal"
                    value={schAmount}
                    onChange={(e) => setSchAmount(e.target.value)}
                  />
                </Field>
                <Field label="Frequency">
                  <Select value={schFreq} onValueChange={(v) => setSchFreq(v as ContributionFrequency)}>
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
                <Field label="Effective from">
                  <Input type="date" value={schFrom} onChange={(e) => setSchFrom(e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Reason for the change">
                    <Textarea value={schReason} onChange={(e) => setSchReason(e.target.value)} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Button
                    onClick={() => saveSchedule.mutate()}
                    disabled={
                      saveSchedule.isPending || !memberId || !schProduct || !schAmount
                    }
                  >
                    Save schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              {schedules.isPending ? (
                <p className="p-6 text-sm text-muted-foreground">Loading…</p>
              ) : (schedules.data ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No member schedules yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Expected</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Effective from</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(schedules.data ?? []).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            {s.members?.first_name} {s.members?.last_name}
                            <span className="block text-xs text-muted-foreground">
                              {s.members?.member_number}
                            </span>
                          </TableCell>
                          <TableCell>{s.savings_products?.product_name}</TableCell>
                          <TableCell className="text-right">{formatNaira(s.expected_amount)}</TableCell>
                          <TableCell>{label(s.frequency)}</TableCell>
                          <TableCell>{formatDate(s.effective_from)}</TableCell>
                          <TableCell>
                            <Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>
                              {label(s.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-4 space-y-4">
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category default contribution</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Membership category">
                  <Select value={catId} onValueChange={setCatId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Savings product">
                  <Select value={catProduct} onValueChange={setCatProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {(products.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.product_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Expected amount (₦)">
                  <Input
                    inputMode="decimal"
                    value={catAmount}
                    onChange={(e) => setCatAmount(e.target.value)}
                  />
                </Field>
                <Field label="Frequency">
                  <Select value={catFreq} onValueChange={(v) => setCatFreq(v as ContributionFrequency)}>
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
                <Field label="Effective from">
                  <Input type="date" value={catFrom} onChange={(e) => setCatFrom(e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Button
                    onClick={() => saveDefault.mutate()}
                    disabled={saveDefault.isPending || !catId || !catProduct || !catAmount}
                  >
                    Save default
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              {(defaults.data ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No category defaults yet. Amounts are entirely yours to set.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Expected</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Effective from</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(defaults.data ?? []).map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>{d.membership_categories?.name}</TableCell>
                          <TableCell>{d.savings_products?.product_name}</TableCell>
                          <TableCell className="text-right">{formatNaira(d.expected_amount)}</TableCell>
                          <TableCell>{label(d.frequency)}</TableCell>
                          <TableCell>{formatDate(d.effective_from)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
