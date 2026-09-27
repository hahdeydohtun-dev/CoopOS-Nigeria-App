import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  ACCOUNT_TYPES,
  downloadCsv,
  friendlyAccountingError,
  label as human,
  type AccountType,
} from "@/lib/accounting";

export const Route = createFileRoute("/admin/accounting/accounts")({
  head: () => ({
    meta: [
      { title: "Chart of accounts — CoopOS Nigeria" },
      { name: "description", content: "The accounts every journal posts into, fully editable." },
      { property: "og:title", content: "Chart of accounts — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "The accounts every journal posts into, fully editable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChartOfAccountsPage,
});

type Account = {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  account_subtype: string | null;
  normal_balance: "DEBIT" | "CREDIT" | null;
  parent_id: string | null;
  is_active: boolean;
  is_system_account: boolean | null;
  allow_manual_posting: boolean | null;
  description: string | null;
};

const emptyForm = {
  code: "",
  name: "",
  account_type: "ASSET" as AccountType,
  account_subtype: "",
  normal_balance: "DEBIT" as "DEBIT" | "CREDIT",
  parent_id: "",
  is_active: true,
  allow_manual_posting: true,
  description: "",
};

function ChartOfAccountsPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const qc = useQueryClient();
  const canEdit = hasPermission("accounting.edit");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);

  const accounts = useQuery({
    queryKey: ["coa", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select(
          "id, code, name, account_type, account_subtype, normal_balance, parent_id, is_active, is_system_account, allow_manual_posting, description",
        )
        .eq("cooperative_id", coopId!)
        .order("code");
      if (error) throw error;
      return (data ?? []) as unknown as Account[];
    },
  });

  const seed = useMutation({
    mutationFn: async () => {
      const coa = await supabase.rpc("seed_sample_chart_of_accounts", {
        _cooperative_id: coopId!,
      });
      if (coa.error) throw coa.error;
      const maps = await supabase.rpc("seed_default_accounting_mappings", {
        _cooperative_id: coopId!,
      });
      if (maps.error) throw maps.error;
      return { accounts: coa.data as number, mappings: maps.data as number };
    },
    onSuccess: (r) => {
      toast.success(`Loaded ${r.accounts} accounts and ${r.mappings} posting rules. Edit freely.`);
      void qc.invalidateQueries({ queryKey: ["coa", coopId] });
    },
    onError: (e) => toast.error(friendlyAccountingError(e)),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        cooperative_id: coopId!,
        code: form.code.trim(),
        name: form.name.trim(),
        account_type: form.account_type,
        account_subtype: form.account_subtype.trim() || null,
        normal_balance: form.normal_balance,
        parent_id: form.parent_id || null,
        is_active: form.is_active,
        allow_manual_posting: form.allow_manual_posting,
        description: form.description.trim() || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("chart_of_accounts")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chart_of_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Account updated." : "Account added.");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      void qc.invalidateQueries({ queryKey: ["coa", coopId] });
    },
    onError: (e) => toast.error(friendlyAccountingError(e)),
  });

  const rows = useMemo(() => {
    const all = accounts.data ?? [];
    return all.filter((a) => {
      if (typeFilter !== "ALL" && a.account_type !== typeFilter) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    });
  }, [accounts.data, typeFilter, search]);

  const startNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const startEdit = (a: Account) => {
    setEditing(a);
    setForm({
      code: a.code,
      name: a.name,
      account_type: a.account_type,
      account_subtype: a.account_subtype ?? "",
      normal_balance: a.normal_balance ?? "DEBIT",
      parent_id: a.parent_id ?? "",
      is_active: a.is_active,
      allow_manual_posting: a.allow_manual_posting ?? true,
      description: a.description ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of accounts"
        description="Your own account list. Sample accounts are only a starting point — rename, add or switch off anything."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "chart-of-accounts.csv",
                  (accounts.data ?? []).map((a) => ({
                    code: a.code,
                    name: a.name,
                    type: a.account_type,
                    group: a.account_subtype,
                    active: a.is_active,
                  })),
                )
              }
            >
              Export
            </Button>
            {canEdit && (accounts.data ?? []).length === 0 && (
              <Button onClick={() => seed.mutate()} disabled={seed.isPending}>
                {seed.isPending ? "Loading…" : "Load sample chart & rules"}
              </Button>
            )}
            {canEdit && <Button onClick={startNew}>New account</Button>}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search code or name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {ACCOUNT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {human(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {accounts.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading accounts…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No accounts to show.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Normal side</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.code}</TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{human(a.account_type)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {human(a.account_subtype)}
                      </TableCell>
                      <TableCell className="text-sm">{human(a.normal_balance)}</TableCell>
                      <TableCell>
                        <Badge variant={a.is_active ? "secondary" : "outline"}>
                          {a.is_active ? "Active" : "Switched off"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <Button size="sm" variant="outline" onClick={() => startEdit(a)}>
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
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.code}` : "New account"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={form.account_type}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    account_type: v as AccountType,
                    normal_balance: v === "ASSET" || v === "EXPENSE" ? "DEBIT" : "CREDIT",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {human(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Normal side</Label>
              <Select
                value={form.normal_balance}
                onValueChange={(v) => setForm({ ...form, normal_balance: v as "DEBIT" | "CREDIT" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEBIT">Debit</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Group (optional)</Label>
              <Input
                value={form.account_subtype}
                placeholder="e.g. BANK, SAVINGS, LOANS"
                onChange={(e) => setForm({ ...form, account_subtype: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Parent account (optional)</Label>
              <Select
                value={form.parent_id || "NONE"}
                onValueChange={(v) => setForm({ ...form, parent_id: v === "NONE" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No parent</SelectItem>
                  {(accounts.data ?? [])
                    .filter((a) => a.id !== editing?.id)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={(c) => setForm({ ...form, is_active: Boolean(c) })}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.allow_manual_posting}
                onCheckedChange={(c) => setForm({ ...form, allow_manual_posting: Boolean(c) })}
              />
              Allow manual journals
            </label>
          </div>
          <DialogFooter>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.code.trim() || !form.name.trim()}
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
