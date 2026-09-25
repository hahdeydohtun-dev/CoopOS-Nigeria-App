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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { friendlyWithdrawalError, label, type WithdrawalType } from "@/lib/withdrawals";

export const Route = createFileRoute("/admin/withdrawals/types")({
  head: () => ({
    meta: [
      { title: "Withdrawal types — CoopOS Nigeria" },
      { name: "description", content: "Set the rules for each kind of withdrawal your cooperative allows." },
      { property: "og:title", content: "Withdrawal types — CoopOS Nigeria" },
      { property: "og:description", content: "Set the rules for each kind of withdrawal your cooperative allows." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WithdrawalTypesPage,
});

const PERIODS = ["CALENDAR_YEAR", "ROLLING_YEAR", "CALENDAR_MONTH", "QUARTER", "ROLLING_DAYS"] as const;

function WithdrawalTypesPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const canEdit = hasPermission("withdrawals.manage_types");
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<WithdrawalType>>({});

  const types = useQuery({
    queryKey: ["withdrawal-types", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_types")
        .select("*")
        .eq("cooperative_id", coopId!)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("withdrawal_types")
        .update({
          name: draft.name ?? "",
          description: draft.description ?? null,
          active: draft.active ?? true,
          minimum_membership_months: Number(draft.minimum_membership_months ?? 0),
          minimum_savings_months: Number(draft.minimum_savings_months ?? 0),
          maximum_percentage: draft.maximum_percentage != null ? Number(draft.maximum_percentage) : null,
          maximum_amount: draft.maximum_amount != null && String(draft.maximum_amount) !== "" ? Number(draft.maximum_amount) : null,
          minimum_amount: Number(draft.minimum_amount ?? 0),
          minimum_balance_after: Number(draft.minimum_balance_after ?? 0),
          frequency_limit: draft.frequency_limit != null && String(draft.frequency_limit) !== "" ? Number(draft.frequency_limit) : null,
          frequency_period: draft.frequency_period ?? "CALENDAR_YEAR",
          frequency_rolling_days:
            draft.frequency_rolling_days != null && String(draft.frequency_rolling_days) !== ""
              ? Number(draft.frequency_rolling_days)
              : null,
          cooling_period_days: Number(draft.cooling_period_days ?? 0),
          requires_no_active_loan: Boolean(draft.requires_no_active_loan),
          requires_no_delinquency: Boolean(draft.requires_no_delinquency),
          requires_purpose: Boolean(draft.requires_purpose),
          requires_document: Boolean(draft.requires_document),
          fee_type: draft.fee_type ?? "NONE",
          fee_value: Number(draft.fee_value ?? 0),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rules saved.");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["withdrawal-types", coopId] });
    },
    onError: (e) => toast.error(friendlyWithdrawalError(e)),
  });

  const num = (v: unknown) => (v == null ? "" : String(v));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdrawal types"
        description="These are sample rules for your cooperative to adjust — nothing here is fixed."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {(types.data ?? []).map((t) => {
          const isEditing = editing === t.id;
          const value = isEditing ? { ...t, ...draft } : t;
          return (
            <Card key={t.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                </div>
                <Badge variant={t.active ? "default" : "outline"}>{t.active ? "In use" : "Off"}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {isEditing ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Name</Label>
                      <Input value={value.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Most as a share of savings (0–1)</Label>
                      <Input
                        value={num(value.maximum_percentage)}
                        onChange={(e) =>
                          setDraft({ ...draft, maximum_percentage: e.target.value === "" ? null : Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Most in naira</Label>
                      <Input
                        value={num(value.maximum_amount)}
                        onChange={(e) =>
                          setDraft({ ...draft, maximum_amount: e.target.value === "" ? null : Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Smallest amount</Label>
                      <Input
                        value={num(value.minimum_amount)}
                        onChange={(e) => setDraft({ ...draft, minimum_amount: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Balance that must stay</Label>
                      <Input
                        value={num(value.minimum_balance_after)}
                        onChange={(e) => setDraft({ ...draft, minimum_balance_after: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Months of membership</Label>
                      <Input
                        value={num(value.minimum_membership_months)}
                        onChange={(e) => setDraft({ ...draft, minimum_membership_months: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Months of saving</Label>
                      <Input
                        value={num(value.minimum_savings_months)}
                        onChange={(e) => setDraft({ ...draft, minimum_savings_months: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">How many times</Label>
                      <Input
                        value={num(value.frequency_limit)}
                        onChange={(e) =>
                          setDraft({ ...draft, frequency_limit: e.target.value === "" ? null : Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Within</Label>
                      <Select
                        value={String(value.frequency_period)}
                        onValueChange={(v) => setDraft({ ...draft, frequency_period: v as WithdrawalType["frequency_period"] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERIODS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {label(p)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Rolling days</Label>
                      <Input
                        value={num(value.frequency_rolling_days)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            frequency_rolling_days: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Waiting days between withdrawals</Label>
                      <Input
                        value={num(value.cooling_period_days)}
                        onChange={(e) => setDraft({ ...draft, cooling_period_days: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Charge type</Label>
                      <Select
                        value={String(value.fee_type)}
                        onValueChange={(v) => setDraft({ ...draft, fee_type: v as WithdrawalType["fee_type"] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">No charge</SelectItem>
                          <SelectItem value="FLAT">Fixed amount</SelectItem>
                          <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Charge value</Label>
                      <Input
                        value={num(value.fee_value)}
                        onChange={(e) => setDraft({ ...draft, fee_value: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-3 sm:col-span-2">
                      {(
                        [
                          ["active", "Available to members"],
                          ["requires_no_active_loan", "Not allowed while a loan is running"],
                          ["requires_no_delinquency", "Not allowed while payments are overdue"],
                          ["requires_purpose", "A reason must be given"],
                          ["requires_document", "A supporting document is required"],
                        ] as const
                      ).map(([key, text]) => (
                        <div key={key} className="flex items-center justify-between gap-4">
                          <span className="text-sm">{text}</span>
                          <Switch
                            checked={Boolean(value[key])}
                            onCheckedChange={(checked) => setDraft({ ...draft, [key]: checked })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>
                      Up to{" "}
                      {t.maximum_percentage != null ? `${Math.round(Number(t.maximum_percentage) * 100)}% of savings` : "no share limit"}
                      {t.maximum_amount != null ? `, capped at ${t.maximum_amount}` : ""}
                    </li>
                    <li>
                      {t.minimum_membership_months} months membership, {t.minimum_savings_months} months saving
                    </li>
                    <li>
                      {t.frequency_limit ?? "No"} time(s) per {label(t.frequency_period).toLowerCase()}
                      {t.frequency_rolling_days ? ` (${t.frequency_rolling_days} days)` : ""}
                    </li>
                    <li>{t.requires_no_active_loan ? "Not allowed with a running loan" : "Allowed with a running loan"}</li>
                    <li>{t.requires_purpose ? "Reason required" : "Reason optional"}</li>
                  </ul>
                )}

                <div className="flex justify-end gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="outline" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                      <Button onClick={() => save.mutate(t.id)} disabled={save.isPending}>
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={!canEdit}
                      onClick={() => {
                        setEditing(t.id);
                        setDraft(t);
                      }}
                    >
                      Edit rules
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
