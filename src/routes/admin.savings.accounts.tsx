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
import { formatDate, formatNaira } from "@/lib/format";
import {
  ACCOUNT_STATUSES,
  accountStatusTone,
  friendlySavingsError,
  label,
  type SavingsAccountStatus,
} from "@/lib/savings";

export const Route = createFileRoute("/admin/savings/accounts")({
  head: () => ({
    meta: [
      { title: "Savings accounts — CoopOS Nigeria" },
      { name: "description", content: "Member savings accounts, balances and account status." },
      { property: "og:title", content: "Savings accounts — CoopOS Nigeria" },
      { property: "og:description", content: "Member savings accounts, balances and account status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SavingsAccountsPage,
});

function SavingsAccountsPage() {
  const { cooperative, hasPermission } = useSession();
  const coopId = cooperative?.id ?? null;
  const canCreate = hasPermission("savings.create");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [productFilter, setProductFilter] = useState<string>("ALL");
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [productId, setProductId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const products = useQuery({
    queryKey: ["savings-products", coopId],
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

  const accounts = useQuery({
    queryKey: ["savings-accounts", coopId, search, status, productFilter],
    enabled: Boolean(coopId),
    queryFn: async () => {
      let q = supabase
        .from("member_savings_accounts")
        .select(
          "id, account_number, status, current_balance, locked_balance, available_balance, opened_date, last_transaction_date, savings_products(product_name), members(first_name, last_name, member_number, membership_number)",
        )
        .eq("cooperative_id", coopId!)
        .order("account_number")
        .limit(200);
      if (status !== "ALL") q = q.eq("status", status as SavingsAccountStatus);
      if (productFilter !== "ALL") q = q.eq("savings_product_id", productFilter);
      if (search.trim()) q = q.ilike("account_number", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const memberOptions = useQuery({
    queryKey: ["savings-member-options", coopId, memberSearch],
    enabled: Boolean(coopId) && open,
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

  const openAccount = useMutation({
    mutationFn: async () => {
      const { data: number, error: numErr } = await supabase.rpc("next_savings_account_number", {
        _cooperative_id: coopId!,
        _member_id: memberId,
        _product_id: productId,
      });
      if (numErr) throw numErr;
      const { error } = await supabase.from("member_savings_accounts").insert({
        cooperative_id: coopId!,
        member_id: memberId,
        savings_product_id: productId,
        account_number: number as string,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Savings account opened.");
      setOpen(false);
      setMemberId("");
      setProductId("");
      void qc.invalidateQueries({ queryKey: ["savings-accounts", coopId] });
    },
    onError: (e) => toast.error(friendlySavingsError(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings accounts"
        description="A member may hold more than one savings account."
        actions={
          canCreate ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Open an account</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Open a savings account</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Find member</Label>
                    <Input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Name or member number"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Member</Label>
                    <Select value={memberId} onValueChange={setMemberId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a member" />
                      </SelectTrigger>
                      <SelectContent>
                        {(memberOptions.data ?? []).map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.first_name} {m.last_name} — {m.member_number ?? m.membership_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Savings product</Label>
                    <Select value={productId} onValueChange={setProductId}>
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
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => openAccount.mutate()}
                    disabled={!memberId || !productId || openAccount.isPending}
                  >
                    {openAccount.isPending ? "Opening…" : "Open account"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search account number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {ACCOUNT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {label(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All products</SelectItem>
            {(products.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.product_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {accounts.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Loading accounts…</p>
          ) : (accounts.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No savings accounts yet. Open one for a member to begin.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account number</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Locked</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>Last entry</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(accounts.data ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.account_number}</TableCell>
                      <TableCell>
                        {a.members?.first_name} {a.members?.last_name}
                        <span className="block text-xs text-muted-foreground">
                          {a.members?.member_number ?? a.members?.membership_number}
                        </span>
                      </TableCell>
                      <TableCell>{a.savings_products?.product_name}</TableCell>
                      <TableCell className="text-right">{formatNaira(a.current_balance)}</TableCell>
                      <TableCell className="text-right">{formatNaira(a.locked_balance)}</TableCell>
                      <TableCell className="text-right">{formatNaira(a.available_balance)}</TableCell>
                      <TableCell>
                        {a.last_transaction_date ? formatDate(a.last_transaction_date) : "No activity"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={accountStatusTone(a.status)}>{label(a.status)}</Badge>
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
