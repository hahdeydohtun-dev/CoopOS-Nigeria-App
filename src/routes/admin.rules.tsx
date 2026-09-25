import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDate, formatNaira, titleCase } from "@/lib/format";

export const Route = createFileRoute("/admin/rules")({
  head: () => ({
    meta: [
      { title: "Cooperative rules — CoopOS Nigeria" },
      {
        name: "description",
        content: "Configurable rules that govern how your cooperative operates.",
      },
      { property: "og:title", content: "Cooperative rules — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Configurable rules that govern how your cooperative operates.",
      },
    ],
  }),
  component: RulesPage,
});

function RulesPage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;

  const rules = useQuery({
    queryKey: ["rules", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cooperative_rules")
        .select("*")
        .eq("cooperative_id", coopId!)
        .order("category")
        .order("rule_name");
      if (error) throw error;
      return data;
    },
  });

  const grouped = new Map<string, typeof rules.data>();
  for (const rule of rules.data ?? []) {
    const key = rule.category ?? "General";
    grouped.set(key, [...(grouped.get(key) ?? []), rule]);
  }

  return (
    <>
      <PageHeader
        title="Cooperative rules"
        description="Nothing is hard-coded: every operating threshold lives here and is versioned by effective date."
      />

      {!coopId ? (
        <p className="text-sm text-muted-foreground">You are not linked to a cooperative yet.</p>
      ) : rules.isPending ? (
        <p className="text-sm text-muted-foreground">Loading rules…</p>
      ) : (
        Array.from(grouped.entries()).map(([category, items]) => (
          <Card key={category}>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {titleCase(category)}
              </h2>
              <ul className="divide-y">
                {(items ?? []).map((rule) => (
                  <li key={rule.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{rule.rule_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {rule.description ?? rule.rule_key}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Effective {formatDate(rule.effective_from)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">
                        {ruleValue(rule)}
                      </span>
                      <Badge variant={rule.active ? "secondary" : "outline"}>
                        {rule.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </>
  );
}

function ruleValue(rule: {
  value_type: string;
  numeric_value: number | null;
  boolean_value: boolean | null;
  text_value: string | null;
  rule_key: string;
}) {
  if (rule.value_type === "BOOLEAN") return rule.boolean_value ? "Yes" : "No";
  if (rule.value_type === "NUMERIC" || rule.value_type === "PERCENTAGE") {
    if (rule.numeric_value === null) return "—";
    if (rule.value_type === "PERCENTAGE") return `${rule.numeric_value}%`;
    return rule.rule_key.includes("amount") || rule.rule_key.includes("min_")
      ? formatNaira(rule.numeric_value)
      : String(rule.numeric_value);
  }
  return rule.text_value ?? "—";
}
