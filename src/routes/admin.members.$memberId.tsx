import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { MemberStatusBadge } from "@/components/member/status-badge";
import { StatusActions } from "@/components/member/status-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDate, formatDateTime } from "@/lib/format";
import {
  NOTE_CATEGORIES,
  friendlyError,
  fullName,
  maskAccountNumber,
  statusLabel,
  type LifecycleStatus,
  type NoteCategory,
} from "@/lib/members";

export const Route = createFileRoute("/admin/members/$memberId")({
  head: () => ({
    meta: [
      { title: "Member record — CoopOS Nigeria" },
      {
        name: "description",
        content: "Full member record: personal details, employment, bank, documents and history.",
      },
      { property: "og:title", content: "Member record — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Full member record: personal details, employment, bank, documents and history.",
      },
    ],
  }),
  component: MemberRecordPage,
});

function MemberRecordPage() {
  const { memberId } = useParams({ from: "/admin/members/$memberId" });
  const { permissions } = useSession();
  const canSeeFullBank = permissions?.includes("members.manage") ?? false;
  const queryClient = useQueryClient();

  const record = useQuery({
    queryKey: ["member-record", memberId],
    queryFn: async () => {
      const [member, memberships, employment, banks, kin, documents, history, notes, verifications] =
        await Promise.all([
          supabase.from("members").select("*").eq("id", memberId).single(),
          supabase
            .from("memberships")
            .select("*, membership_categories(name), branches(name)")
            .eq("member_id", memberId)
            .order("application_date", { ascending: false }),
          supabase.from("member_employment").select("*").eq("member_id", memberId),
          supabase.from("member_bank_accounts").select("*").eq("member_id", memberId),
          supabase.from("member_next_of_kin").select("*").eq("member_id", memberId),
          supabase
            .from("member_documents")
            .select("*")
            .eq("member_id", memberId)
            .order("created_at", { ascending: false }),
          supabase
            .from("member_status_history")
            .select("*")
            .eq("member_id", memberId)
            .order("created_at", { ascending: false }),
          supabase
            .from("member_notes")
            .select("*")
            .eq("member_id", memberId)
            .order("created_at", { ascending: false }),
          supabase
            .from("member_verifications")
            .select("*")
            .eq("member_id", memberId)
            .order("requested_at", { ascending: false }),
        ]);
      if (member.error) throw member.error;
      return {
        member: member.data,
        memberships: memberships.data ?? [],
        employment: employment.data?.[0] ?? null,
        banks: banks.data ?? [],
        kin: kin.data ?? [],
        documents: documents.data ?? [],
        history: history.data ?? [],
        notes: notes.data ?? [],
        verifications: verifications.data ?? [],
      };
    },
  });

  const [note, setNote] = useState("");
  const [noteCategory, setNoteCategory] = useState<NoteCategory>("GENERAL");
  const [verifyReason, setVerifyReason] = useState("");

  const addNote = useMutation({
    mutationFn: async () => {
      if (!record.data) return;
      if (!note.trim()) throw new Error("Please write the note first.");
      const { error } = await supabase.from("member_notes").insert({
        cooperative_id: record.data.member.cooperative_id,
        member_id: memberId,
        category: noteCategory,
        note: note.trim(),
        member_visible: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      toast.success("Note saved. Members cannot see staff notes.");
      void queryClient.invalidateQueries({ queryKey: ["member-record", memberId] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const verification = useMutation({
    mutationFn: async (action: "VERIFY" | "REQUEST_CORRECTION" | "REJECT" | "ESCALATE") => {
      if (!record.data) return;
      if (action !== "VERIFY" && !verifyReason.trim())
        throw new Error("Please give a reason for this decision.");
      const { error } = await supabase.from("member_verifications").insert({
        cooperative_id: record.data.member.cooperative_id,
        member_id: memberId,
        membership_id: record.data.memberships[0]?.id ?? null,
        action,
        reason: verifyReason.trim() || null,
        resolved: action === "VERIFY",
      });
      if (error) throw error;

      if (action === "VERIFY") {
        const { error: statusError } = await supabase.rpc("change_member_status", {
          _member_id: memberId,
          _new_status: "PENDING_APPROVAL",
          _reason: verifyReason.trim() || "Details verified",
          _effective_date: new Date().toISOString().slice(0, 10),
        });
        if (statusError) throw statusError;
      }
      if (action === "REQUEST_CORRECTION") {
        const { error: statusError } = await supabase.rpc("change_member_status", {
          _member_id: memberId,
          _new_status: "PROSPECTIVE",
          _reason: verifyReason.trim(),
          _effective_date: new Date().toISOString().slice(0, 10),
        });
        if (statusError) throw statusError;
      }
    },
    onSuccess: () => {
      setVerifyReason("");
      toast.success("Decision recorded.");
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const openDocument = useMutation({
    mutationFn: async (path: string) => {
      const { data, error } = await supabase.storage
        .from("member-documents")
        .createSignedUrl(path, 120);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener");
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  if (record.isPending) {
    return <p className="text-sm text-muted-foreground">Loading member record…</p>;
  }
  if (record.isError || !record.data) {
    return <p className="text-sm text-destructive">{friendlyError(record.error)}</p>;
  }

  const { member, memberships, employment, banks, kin, documents, history, notes, verifications } =
    record.data;
  const membership = memberships[0] ?? null;
  const status = member.lifecycle_status as LifecycleStatus;

  return (
    <>
      <PageHeader
        title={fullName(member)}
        description={`${member.member_number ?? member.membership_number} · joined ${formatDate(member.join_date)}`}
        actions={
          <>
            {member.is_demo && <Badge variant="outline">Demo record</Badge>}
            <MemberStatusBadge status={status} />
            <Button variant="outline" asChild>
              <Link to="/admin/members">Back to directory</Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusActions memberId={memberId} current={status} />
          {(status === "PENDING_VERIFICATION" || status === "PENDING_APPROVAL") && (
            <div className="space-y-3 rounded-md border bg-muted/40 p-3">
              <Label htmlFor="verify-reason">Verification note</Label>
              <Textarea
                id="verify-reason"
                rows={2}
                value={verifyReason}
                onChange={(e) => setVerifyReason(e.target.value)}
                placeholder="What did you check, or what needs correcting?"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => verification.mutate("VERIFY")}>
                  Verify details
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => verification.mutate("REQUEST_CORRECTION")}
                >
                  Request correction
                </Button>
                <Button size="sm" variant="outline" onClick={() => verification.mutate("ESCALATE")}>
                  Escalate
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => verification.mutate("REJECT")}
                >
                  Reject
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="mt-6">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="bank">Bank</TabsTrigger>
            <TabsTrigger value="kin">Next of kin</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="membership">Membership</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Member number" value={member.member_number ?? member.membership_number} />
              <Detail label="Status" value={statusLabel[status]} />
              <Detail label="Category" value={membership?.membership_categories?.name} />
              <Detail label="Branch" value={membership?.branches?.name} />
              <Detail label="Department" value={membership?.department} />
              <Detail label="Phone" value={member.phone} />
              <Detail label="Email" value={member.email} />
              <Detail label="Joined" value={formatDate(member.join_date)} />
              <Detail label="Employer" value={member.employer} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personal" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Title" value={member.title} />
              <Detail label="First name" value={member.first_name} />
              <Detail label="Middle name" value={member.middle_name} />
              <Detail label="Last name" value={member.last_name} />
              <Detail label="Preferred name" value={member.preferred_name} />
              <Detail label="Gender" value={member.gender} />
              <Detail label="Date of birth" value={formatDate(member.date_of_birth)} />
              <Detail label="Marital status" value={member.marital_status} />
              <Detail label="Nationality" value={member.nationality} />
              <Detail label="Address" value={member.residential_address} />
              <Detail label="City" value={member.city} />
              <Detail label="State" value={member.state} />
              <Detail label="Country" value={member.country} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
              {employment ? (
                <>
                  <Detail label="Employer" value={employment.employer_name} />
                  <Detail label="Department" value={employment.department} />
                  <Detail label="Designation" value={employment.designation} />
                  <Detail label="Employee ID" value={employment.employee_id} />
                  <Detail label="Grade level" value={employment.grade_level} />
                  <Detail label="Employment type" value={employment.employment_type} />
                  <Detail label="Employment status" value={employment.employment_status} />
                  <Detail label="Date employed" value={formatDate(employment.date_employed)} />
                  <Detail label="Payroll frequency" value={employment.payroll_frequency} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No employment record captured yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {banks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bank account on file.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank</TableHead>
                      <TableHead>Account name</TableHead>
                      <TableHead>Account number</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banks.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>{b.bank_name}</TableCell>
                        <TableCell>{b.account_name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {canSeeFullBank ? b.account_number : maskAccountNumber(b.account_number)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{b.change_status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!canSeeFullBank && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Account numbers are hidden. Only authorised officers can see them in full.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kin" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {kin.length === 0 ? (
                <p className="text-sm text-muted-foreground">No next of kin recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Allocation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kin.map((k) => (
                      <TableRow key={k.id}>
                        <TableCell>{k.name}</TableCell>
                        <TableCell>{k.relationship ?? "—"}</TableCell>
                        <TableCell>{k.phone ?? k.email ?? "—"}</TableCell>
                        <TableCell>{k.percentage}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{d.document_type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {d.file_name}
                        </TableCell>
                        <TableCell className="text-sm">{formatDateTime(d.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{d.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDocument.mutate(d.storage_path)}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="membership" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {memberships.length === 0 ? (
                <p className="text-sm text-muted-foreground">No membership record.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Effective</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberships.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">
                          {m.membership_number ?? "—"}
                        </TableCell>
                        <TableCell>{m.membership_type}</TableCell>
                        <TableCell>{m.membership_categories?.name ?? "—"}</TableCell>
                        <TableCell>{formatDate(m.application_date)}</TableCell>
                        <TableCell>{formatDate(m.effective_date)}</TableCell>
                        <TableCell>
                          <MemberStatusBadge status={m.status as LifecycleStatus} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="mb-3 text-sm font-medium">Status history</h2>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {history.map((h) => (
                      <li key={h.id} className="rounded-md border p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <MemberStatusBadge status={h.new_status as LifecycleStatus} />
                          <span className="text-xs text-muted-foreground">
                            from {h.previous_status ? statusLabel[h.previous_status as LifecycleStatus] : "—"} ·{" "}
                            {formatDateTime(h.created_at)}
                          </span>
                        </div>
                        {h.reason && <p className="mt-2 text-muted-foreground">{h.reason}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h2 className="mb-3 text-sm font-medium">Verification decisions</h2>
                {verifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No verification decisions yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {verifications.map((v) => (
                      <li key={v.id} className="rounded-md border p-3">
                        <span className="font-medium">{v.action}</span>{" "}
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(v.requested_at)}
                        </span>
                        {v.reason && <p className="mt-1 text-muted-foreground">{v.reason}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select
                    value={noteCategory}
                    onValueChange={(v) => setNoteCategory(v as NoteCategory)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.charAt(0) + c.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="member-note">Staff note</Label>
                  <Textarea
                    id="member-note"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Only staff can read this."
                  />
                </div>
              </div>
              <Button onClick={() => addNote.mutate()} disabled={addNote.isPending || !note.trim()}>
                {addNote.isPending ? "Saving…" : "Add note"}
              </Button>

              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <ul className="space-y-2">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{n.category}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(n.created_at)}
                        </span>
                      </div>
                      <p className="mt-2">{n.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="mt-4">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Savings, shares, loans, repayments and withdrawals will appear here once those modules
              are built. No figures are shown until real accounts exist.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Detail({ label, value }: { label: string; value?: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}
