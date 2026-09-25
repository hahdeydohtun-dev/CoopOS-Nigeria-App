import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { MemberStatusBadge } from "@/components/member/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  LIFECYCLE_STATUSES,
  PAGE_SIZES,
  friendlyError,
  statusLabel,
  type LifecycleStatus,
} from "@/lib/members";

export const Route = createFileRoute("/admin/members/")({
  validateSearch: (search: Record<string, unknown>): { status?: string } =>
    typeof search['status'] === "string" ? { status: search['status'] } : {},

  head: () => ({
    meta: [
      { title: "Member directory — CoopOS Nigeria" },
      {
        name: "description",
        content: "Search, filter and manage every member of your cooperative society.",
      },
      { property: "og:title", content: "Member directory — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Search, filter and manage every member of your cooperative society.",
      },
    ],
  }),
  component: MemberDirectory,
});


const ALL = "ALL";

function MemberDirectory() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;
  const queryClient = useQueryClient();
  const { status: statusFromLink } = Route.useSearch();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(statusFromLink ?? ALL);

  const [category, setCategory] = useState<string>(ALL);
  const [branch, setBranch] = useState<string>(ALL);
  const [sort, setSort] = useState("member_number");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);

  const branches = useQuery({
    queryKey: ["branches", coopId],
    enabled: Boolean(coopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .eq("cooperative_id", coopId!)
        .order("name");
      if (error) throw error;
      return data;
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
      return data;
    },
  });

  const members = useQuery({
    queryKey: ["member-directory", coopId, search, status, category, branch, sort, pageSize, page],
    enabled: Boolean(coopId),
    queryFn: async () => {
      let query = supabase
        .from("members")
        .select(
          "id, member_number, membership_number, first_name, last_name, middle_name, email, phone, staff_number, lifecycle_status, join_date, is_demo, branch_id, memberships(category_id, department, employee_id, membership_categories(name))",
          { count: "exact" },
        )
        .eq("cooperative_id", coopId!);

      const q = search.trim();
      if (q) {
        const like = `%${q}%`;
        query = query.or(
          `member_number.ilike.${like},membership_number.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like},email.ilike.${like},staff_number.ilike.${like}`,
        );
      }
      if (status !== ALL) query = query.eq("lifecycle_status", status as LifecycleStatus);
      if (branch !== ALL) query = query.eq("branch_id", branch);

      const from = page * pageSize;
      const { data, error, count } = await query
        .order(sort, { ascending: true, nullsFirst: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;

      const rows = (data ?? []).filter((m) => {
        if (category === ALL) return true;
        return (m.memberships ?? []).some((ms) => ms.category_id === category);
      });
      return { rows, count: count ?? 0 };
    },
  });

  const bulk = useMutation({
    mutationFn: async (action: { kind: "category" | "branch"; value: string }) => {
      if (selected.length === 0) throw new Error("Select at least one member first.");
      if (action.kind === "branch") {
        const { error } = await supabase
          .from("members")
          .update({ branch_id: action.value })
          .in("id", selected);
        if (error) throw error;
        const { error: msError } = await supabase
          .from("memberships")
          .update({ branch_id: action.value })
          .in("member_id", selected);
        if (msError) throw msError;
      } else {
        const { error } = await supabase
          .from("memberships")
          .update({ category_id: action.value })
          .in("member_id", selected);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Members updated.");
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ["member-directory"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  function exportCsv() {
    const rows = members.data?.rows ?? [];
    if (rows.length === 0) {
      toast.error("There is nothing to export with the current filters.");
      return;
    }
    const header = [
      "Member number",
      "First name",
      "Last name",
      "Phone",
      "Email",
      "Staff number",
      "Status",
      "Joined",
    ];
    const lines = rows.map((m) =>
      [
        m.member_number ?? m.membership_number,
        m.first_name,
        m.last_name,
        m.phone ?? "",
        m.email ?? "",
        m.staff_number ?? "",
        m.lifecycle_status,
        m.join_date,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const rows = members.data?.rows ?? [];
  const total = members.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  if (!coopId) {
    return (
      <>
        <PageHeader title="Members" description="Your cooperative's member register." />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You are not linked to a cooperative yet.
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Members"
        description="Search, filter and manage every person registered with your society."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              Export CSV
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin/members/import">Import members</Link>
            </Button>
            <Button asChild>
              <Link to="/admin/members/new">Add member</Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="member-search">Search</Label>
              <Input
                id="member-search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Number, name, phone, email, staff number"
              />
            </div>
            <Filter label="Status" value={status} onChange={setStatus}>
              {LIFECYCLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel[s]}
                </SelectItem>
              ))}
            </Filter>
            <Filter label="Category" value={category} onChange={setCategory}>
              {(categories.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </Filter>
            <Filter label="Branch" value={branch} onChange={setBranch}>
              {(branches.data ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </Filter>
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3">
              <span className="text-sm font-medium">{selected.length} selected</span>
              <Select onValueChange={(v) => bulk.mutate({ kind: "category", value: v })}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Assign category" />
                </SelectTrigger>
                <SelectContent>
                  {(categories.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={(v) => bulk.mutate({ kind: "branch", value: v })}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Assign branch" />
                </SelectTrigger>
                <SelectContent>
                  {(branches.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Clear
              </Button>
              <span className="text-xs text-muted-foreground">
                Suspension and reactivation are done from a member's record so a reason is recorded.
              </span>
            </div>
          )}

          {members.isPending ? (
            <p className="text-sm text-muted-foreground">Loading members…</p>
          ) : members.isError ? (
            <p className="text-sm text-destructive">{friendlyError(members.error)}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No members match these filters. Try clearing the search or add a new member.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(m.id)}
                          onCheckedChange={(v) =>
                            setSelected((prev) =>
                              v === true ? [...prev, m.id] : prev.filter((id) => id !== m.id),
                            )
                          }
                          aria-label={`Select ${m.first_name} ${m.last_name}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {m.member_number ?? m.membership_number}
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/admin/members/$memberId"
                          params={{ memberId: m.id }}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {m.first_name} {m.last_name}
                        </Link>
                        {m.is_demo && (
                          <Badge variant="outline" className="ml-2">
                            Demo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.email ?? m.phone ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.memberships?.[0]?.membership_categories?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(m.join_date)}</TableCell>
                      <TableCell>
                        <MemberStatusBadge status={m.lifecycle_status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member_number">Sort by number</SelectItem>
                  <SelectItem value="last_name">Sort by last name</SelectItem>
                  <SelectItem value="join_date">Sort by join date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Page {page + 1} of {pageCount} · {total} members
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => (p + 1 < pageCount ? p + 1 : p))}
                disabled={page + 1 >= pageCount}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {children}
        </SelectContent>
      </Select>
    </div>
  );
}
