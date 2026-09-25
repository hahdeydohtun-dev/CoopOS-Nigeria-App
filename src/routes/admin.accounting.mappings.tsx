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
} from "@/components/ui/dialog";
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
import { ACCOUNTING_EVENTS, friendlyAccountingError, label as human } from "@/lib/accounting";

export const Route = createFileRoute("/admin/accounting/mappings")({
  head: () => ({
    meta: [
      { title: "Posting rules — CoopOS Nigeria" },
      {
        name: "description",
        content: "Decide which accounts each savings, loan or withdrawal event posts to.",
      },
      { property: "og:title", content: "Posting rules — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Decide which accounts each savings, loan or withdrawal event posts to.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MappingsPage,
});

type Mapping = {
  id: string;
  event_code: string;
  debit_account_id: string;
  credit_account_id: string;
  savings_product_id: string | null;
  loan_product_id: string | null;
  withdrawal_type_id: string | null;
  priority: number | null;
  is_active: boolean;
  description: string | null;
};

const blank = {
  event_code: ACCOUNTING_EVENTS[0] as string,
  debit_account_id: "",
  credit_account_id: "",
  priority: 100,
  is_active: true,
  description: "",
};

function MappingsPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const qc = useQueryClient();
  const canEdit = hasPermission("accounting.configure") || hasPermission("accounting.edit");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Mapping | null>(null);
  const [form, setForm] = useState(blank);

  const accounts = useQuery({
    queryKey: ["coa-simple", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, is_active")
        .eq("cooperative_id", coopId!)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const mappings = useQuery({
    queryKey: ["accounting-mappings", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_mappings")
        .select("*")
        .eq("cooperative_id", coopId!)
        .order("event_code");
      if (error) throw error;
      return (data ?? []) as unknown as Mapping[];
    },
  });

  const accountName = (id: string | null) => {
    const a = (accounts.data ?? []).find((x) => x.id === id);
    return a ? `${a.code} — ${a.name}` : "—";
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        cooperative_id: coopId!,
        event_code: form.event_code,
        debit_account_id: form.debit_account_id,
        credit_account_id: form.credit_account_id,
        priority: form.priority,
        is_active: form.is_active,
        description: form.description.trim() || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("accounting_mappings")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("accounting_mappings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Posting rule saved.");
      setOpen(false);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["accounting-mappings", coopId] });
    },
    onError: (e) => toast.error(friendlyAccountingError(e)),
  });

  const seed = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("seed_default_accounting_mappings", {
        _cooperative_id: coopId!,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`Added ${n} default rules. Change any of them as you wish.`);
      void qc.invalidateQueries({ queryKey: ["accounting-mappings", coopId] });
    },
    onError: (e) => toast.error(friendlyAccountingError(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Posting rules"
        description="Each business event posts to the two accounts you choose here. Nothing is hard-coded."
        actions={
          canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
                Load defaults
              </Button>
              <Button
                onClick={() => {
                  setEditing(null);
                  setForm(blank);
                  setOpen(true);
                }}
              >
                New rule
              </Button>
            </div>
          )
        }
      />

      <Card>
        <CardContent className="p-0">
          {mappings.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading rules…</p>
          ) : (mappings.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No posting rules yet. Load the defaults, then edit them to match your own accounts.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Debit</TableHead>
                    <TableHead>Credit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(mappings.data ?? []).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{human(m.event_code)}</TableCell>
                      <TableCell className="text-sm">{accountName(m.debit_account_id)}</TableCell>
                      <TableCell className="text-sm">{accountName(m.credit_account_id)}</TableCell>
                      <TableCell>
                        <Badge variant={m.is_active ? "secondary" : "outline"}>
                          {m.is_active ? "Active" : "Off"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(m);
                              setForm({
                                event_code: m.event_code,
                                debit_account_id: m.debit_account_id,
                                credit_account_id: m.credit_account_id,
                                priority: m.priority ?? 100,
                                is_active: m.is_active,
                                description: m.description ?? "",
                              });
                              setOpen(true);
                            }}
                          >
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit posting rule" : "New posting rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Event</Label>
              <Select
                value={form.event_code}
                onValueChange={(v) => setForm({ ...form, event_code: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNTING_EVENTS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {human(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(["debit_account_id", "credit_account_id"] as const).map((field) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs">
                  {field === "debit_account_id" ? "Debit account" : "Credit account"}
                </Label>
                <Select
                  value={form[field] || "NONE"}
                  onValueChange={(v) => setForm({ ...form, [field]: v === "NONE" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Choose an account</SelectItem>
                    {(accounts.data ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="space-y-1">
              <Label className="text-xs">Note</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => save.mutate()}
              disabled={
                save.isPending ||
                !form.debit_account_id ||
                !form.credit_account_id ||
                form.debit_account_id === form.credit_account_id
              }
            >
              {save.isPending ? "Saving…" : "Save rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
