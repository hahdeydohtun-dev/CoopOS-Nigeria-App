import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
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
import { useSession } from "@/lib/session";
import { friendlyLoanError, label } from "@/lib/loans";
import {
  DEFAULT_WATERFALL,
  RULE_KEYS,
  loadRepaymentRules,
  saveRepaymentRule,
  type AllocationType,
} from "@/lib/repayments";

export const Route = createFileRoute("/admin/repayments/settings")({
  head: () => ({
    meta: [
      { title: "Repayment settings — CoopOS Nigeria" },
      { name: "description", content: "Order of settlement, grace days, penalty policy and overpayment handling." },
      { property: "og:title", content: "Repayment settings — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Order of settlement, grace days, penalty policy and overpayment handling.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RepaymentSettingsPage,
});

const ALL_TYPES: AllocationType[] = [
  "PENALTY",
  "PROCESSING_FEE",
  "ADMIN_FEE",
  "INSURANCE",
  "INTEREST",
  "PRINCIPAL",
  "OTHER",
];

function RepaymentSettingsPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const queryClient = useQueryClient();

  const rules = useQuery({
    queryKey: ["repayment-rules", coopId],
    enabled: Boolean(coopId),
    queryFn: () => loadRepaymentRules(coopId!),
  });

  const [waterfall, setWaterfall] = useState<AllocationType[]>(DEFAULT_WATERFALL);
  const [grace, setGrace] = useState("5");
  const [npl, setNpl] = useState("90");
  const [penaltyRate, setPenaltyRate] = useState("");
  const [basis, setBasis] = useState("OVERDUE_AMOUNT");
  const [overpayment, setOverpayment] = useState("HOLD");

  useEffect(() => {
    const r = rules.data;
    if (!r) return;
    setWaterfall(r.waterfall);
    setGrace(String(r.graceDays));
    setNpl(String(r.nplThreshold));
    setPenaltyRate(r.penaltyRate === null ? "" : String(r.penaltyRate));
    setBasis(r.penaltyBasis);
    setOverpayment(r.overpaymentTreatment);
  }, [rules.data]);

  const save = useMutation({
    mutationFn: async () => {
      await saveRepaymentRule({
        coopId: coopId!,
        key: RULE_KEYS.waterfall,
        name: "Order money is applied",
        json: waterfall,
      });
      await saveRepaymentRule({
        coopId: coopId!,
        key: RULE_KEYS.graceDays,
        name: "Grace days before a payment counts as late",
        numeric: Number(grace) || 0,
      });
      await saveRepaymentRule({
        coopId: coopId!,
        key: RULE_KEYS.nplThreshold,
        name: "Days late before a loan is non-performing",
        numeric: Number(npl) || 90,
      });
      await saveRepaymentRule({
        coopId: coopId!,
        key: RULE_KEYS.penaltyRate,
        name: "Late payment charge rate (% per year)",
        numeric: penaltyRate === "" ? null : Number(penaltyRate),
      });
      await saveRepaymentRule({
        coopId: coopId!,
        key: RULE_KEYS.penaltyBasis,
        name: "What the late charge is calculated on",
        text: basis,
      });
      await saveRepaymentRule({
        coopId: coopId!,
        key: RULE_KEYS.overpayment,
        name: "What happens to money paid above what is due",
        text: overpayment,
      });
    },
    onSuccess: () => {
      toast.success("Repayment policy saved.");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyLoanError(e)),
  });

  const move = (index: number, delta: number) => {
    const next = [...waterfall];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    setWaterfall(next);
  };

  const canEdit = hasPermission("repayments.approve") || hasPermission("loans.configure");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repayment settings"
        description="These settings decide how every payment is applied and when a loan is treated as late."
        actions={
          <Button onClick={() => save.mutate()} disabled={!canEdit || save.isPending}>
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order money is applied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A payment settles these in order, oldest instalment first.
          </p>
          <ol className="space-y-2">
            {waterfall.map((t, i) => (
              <li key={t} className="flex items-center gap-2 rounded-md border p-2">
                <span className="w-6 text-sm text-muted-foreground">{i + 1}.</span>
                <span className="flex-1 text-sm font-medium">{label(t)}</span>
                <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={!canEdit}>
                  Up
                </Button>
                <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={!canEdit}>
                  Down
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canEdit || waterfall.length <= 2}
                  onClick={() => setWaterfall(waterfall.filter((x) => x !== t))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            {ALL_TYPES.filter((t) => !waterfall.includes(t)).map((t) => (
              <Button
                key={t}
                size="sm"
                variant="outline"
                disabled={!canEdit}
                onClick={() => setWaterfall([...waterfall, t])}
              >
                Add {label(t)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lateness and charges</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Grace days</Label>
            <Input type="number" min="0" value={grace} onChange={(e) => setGrace(e.target.value)} disabled={!canEdit} />
            <p className="text-xs text-muted-foreground">Days allowed after the due date before counting as late.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Non-performing from (days late)</Label>
            <Input type="number" min="1" value={npl} onChange={(e) => setNpl(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1.5">
            <Label>Late payment charge (% per year)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={penaltyRate}
              onChange={(e) => setPenaltyRate(e.target.value)}
              placeholder="Use the loan product's rate"
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Charge calculated on</Label>
            <Select value={basis} onValueChange={setBasis} disabled={!canEdit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OVERDUE_AMOUNT">The overdue amount</SelectItem>
                <SelectItem value="OUTSTANDING_PRINCIPAL">The outstanding principal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Money paid above what is due</Label>
            <Select value={overpayment} onValueChange={setOverpayment} disabled={!canEdit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HOLD">Hold it until someone decides</SelectItem>
                <SelectItem value="ADVANCE">Treat it as paying future instalments</SelectItem>
                <SelectItem value="PRINCIPAL_REDUCTION">Reduce the loan balance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
