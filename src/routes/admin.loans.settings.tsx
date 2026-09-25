import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useSession, roleLabel, type AppRole } from "@/lib/session";
import { formatNaira } from "@/lib/format";
import { friendlyLoanError } from "@/lib/loans";

const APPROVAL_ROLES: AppRole[] = [
  "LOAN_OFFICER",
  "TREASURER",
  "APPROVER",
  "COOPERATIVE_MANAGER",
  "COOPERATIVE_ADMIN",
  "COMMITTEE_MEMBER",
];

export const Route = createFileRoute("/admin/loans/settings")({
  head: () => ({
    meta: [
      { title: "Loan settings — CoopOS Nigeria" },
      { name: "description", content: "Loan purposes and approval limits by amount band." },
      { property: "og:title", content: "Loan settings — CoopOS Nigeria" },
      { property: "og:description", content: "Loan purposes and approval limits by amount band." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoanSettingsPage,
});

function LoanSettingsPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const canManage = hasPermission("loans.configure");
  const qc = useQueryClient();

  const [purposeCode, setPurposeCode] = useState("");
  const [purposeName, setPurposeName] = useState("");
  const [limitLabel, setLimitLabel] = useState("");
  const [minAmount, setMinAmount] = useState("0");
  const [maxAmount, setMaxAmount] = useState("");
  const [requiredRole, setRequiredRole] = useState<string>("APPROVER");
  const [requiresCommittee, setRequiresCommittee] = useState(false);

  const purposes = useQuery({
    queryKey: ["loan-purposes", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_purposes")
        .select("*")
        .eq("cooperative_id", coopId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const limits = useQuery({
    queryKey: ["loan-limits", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_approval_limits")
        .select("*")
        .eq("cooperative_id", coopId!)
        .order("minimum_amount");
      if (error) throw error;
      return data ?? [];
    },
  });

  const addPurpose = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("loan_purposes").insert({
        cooperative_id: coopId!,
        code: purposeCode.trim().toUpperCase(),
        name: purposeName.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Loan purpose added.");
      setPurposeCode("");
      setPurposeName("");
      void qc.invalidateQueries({ queryKey: ["loan-purposes", coopId] });
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const addLimit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("loan_approval_limits").insert({
        cooperative_id: coopId!,
        label: limitLabel.trim(),
        minimum_amount: Number(minAmount || 0),
        maximum_amount: maxAmount ? Number(maxAmount) : null,
        required_role: requiredRole as never,
        requires_committee: requiresCommittee,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Approval band added.");
      setLimitLabel("");
      setMinAmount("0");
      setMaxAmount("");
      setRequiresCommittee(false);
      void qc.invalidateQueries({ queryKey: ["loan-limits", coopId] });
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan settings"
        description="Purposes and approval bands are configuration, never hard-coded rules."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loan purposes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Code</Label>
                <Input value={purposeCode} onChange={(e) => setPurposeCode(e.target.value)} placeholder="EDU" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={purposeName} onChange={(e) => setPurposeName(e.target.value)} placeholder="Education" />
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  disabled={!purposeCode.trim() || !purposeName.trim() || addPurpose.isPending}
                  onClick={() => addPurpose.mutate()}
                >
                  Add purpose
                </Button>
              </div>
            </div>
          )}
          {(purposes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No loan purpose configured yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(purposes.data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.code}</TableCell>
                    <TableCell>{p.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval bands</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage && (
            <div className="grid gap-3 sm:grid-cols-5">
              <div className="space-y-1.5">
                <Label className="text-xs">Band name</Label>
                <Input value={limitLabel} onChange={(e) => setLimitLabel(e.target.value)} placeholder="Management" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">From (₦)</Label>
                <Input inputMode="decimal" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To (₦)</Label>
                <Input inputMode="decimal" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Who may approve</Label>
                <Select value={requiredRole} onValueChange={setRequiredRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {APPROVAL_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <Switch checked={requiresCommittee} onCheckedChange={setRequiresCommittee} />
                  Committee too
                </label>
                <Button className="w-full" disabled={!limitLabel.trim() || addLimit.isPending} onClick={() => addLimit.mutate()}>
                  Add band
                </Button>
              </div>
            </div>
          )}
          {(limits.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No approval band configured yet. Without a band, anyone with approval rights may approve any amount.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Band</TableHead>
                  <TableHead className="text-right">From</TableHead>
                  <TableHead className="text-right">To</TableHead>
                  <TableHead>Who may approve</TableHead>
                  <TableHead>Committee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(limits.data ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNaira(l.minimum_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.maximum_amount ? formatNaira(l.maximum_amount) : "No ceiling"}
                    </TableCell>
                    <TableCell>{l.required_role ? roleLabel(l.required_role) : "Anyone with approval rights"}</TableCell>
                    <TableCell>{l.requires_committee ? "Required" : "—"}</TableCell>
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
