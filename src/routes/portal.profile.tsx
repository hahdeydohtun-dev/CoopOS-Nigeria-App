import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { MemberStatusBadge } from "@/components/member/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { formatDate } from "@/lib/format";
import {
  DOCUMENT_TYPES,
  friendlyError,
  isValidEmail,
  isValidNigerianPhone,
  maskAccountNumber,
  type LifecycleStatus,
} from "@/lib/members";

export const Route = createFileRoute("/portal/profile")({
  head: () => ({
    meta: [
      { title: "My profile — CoopOS Nigeria" },
      {
        name: "description",
        content: "Update your contact details, upload documents and request a bank change.",
      },
      { property: "og:title", content: "My profile — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Update your contact details, upload documents and request a bank change.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ["my-member-record", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const memberId = me.data?.id ?? null;

  const banks = useQuery({
    queryKey: ["my-banks", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_bank_accounts")
        .select("*")
        .eq("member_id", memberId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const documents = useQuery({
    queryKey: ["my-documents", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_documents")
        .select("*")
        .eq("member_id", memberId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    phone: "",
    email: "",
    residential_address: "",
    city: "",
    state: "",
  });

  useEffect(() => {
    if (me.data) {
      setForm({
        phone: me.data.phone ?? "",
        email: me.data.email ?? "",
        residential_address: me.data.residential_address ?? "",
        city: me.data.city ?? "",
        state: me.data.state ?? "",
      });
    }
  }, [me.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!memberId) return;
      if (form.phone && !isValidNigerianPhone(form.phone))
        throw new Error("Please check your phone number.");
      if (form.email && !isValidEmail(form.email)) throw new Error("Please check your email.");
      const { error } = await supabase.from("members").update(form).eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Your contact details were saved.");
      void queryClient.invalidateQueries({ queryKey: ["my-member-record"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const [bankForm, setBankForm] = useState({
    bank_name: "",
    account_number: "",
    account_name: "",
    reason: "",
  });

  const requestBankChange = useMutation({
    mutationFn: async () => {
      if (!me.data) return;
      if (!bankForm.bank_name || !bankForm.account_number || !bankForm.account_name)
        throw new Error("Please fill in the bank, account number and account name.");
      const { error } = await supabase.from("member_bank_accounts").insert({
        cooperative_id: me.data.cooperative_id,
        member_id: me.data.id,
        bank_name: bankForm.bank_name,
        account_number: bankForm.account_number,
        account_name: bankForm.account_name,
        is_primary: false,
        change_status: "PENDING",
        change_reason: bankForm.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBankForm({ bank_name: "", account_number: "", account_name: "", reason: "" });
      toast.success("Bank change requested. An officer must approve it before it takes effect.");
      void queryClient.invalidateQueries({ queryKey: ["my-banks"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const [docType, setDocType] = useState(DOCUMENT_TYPES[0] ?? "Other");

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!me.data) return;
      const path = `${me.data.cooperative_id}/${me.data.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("member-documents")
        .upload(path, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("member_documents").insert({
        cooperative_id: me.data.cooperative_id,
        member_id: me.data.id,
        document_type: docType,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        file_size: file.size,
        status: "UPLOADED",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document uploaded for review.");
      void queryClient.invalidateQueries({ queryKey: ["my-documents"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const [exitReason, setExitReason] = useState("");

  const requestExit = useMutation({
    mutationFn: async () => {
      if (!memberId) return;
      if (!exitReason.trim()) throw new Error("Please give a reason for leaving.");
      const { error } = await supabase.rpc("change_member_status", {
        _member_id: memberId,
        _new_status: "EXIT_PENDING",
        _reason: exitReason.trim(),
        _effective_date: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setExitReason("");
      toast.success("Your exit request has been sent to the cooperative.");
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  if (me.isPending) return <p className="text-sm text-muted-foreground">Loading your profile…</p>;
  if (me.isError) return <p className="text-sm text-destructive">{friendlyError(me.error)}</p>;
  if (!me.data) {
    return (
      <>
        <PageHeader title="My profile" description="No membership record is linked yet." />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Ask your cooperative to link your membership to this account.
          </CardContent>
        </Card>
      </>
    );
  }

  const member = me.data;

  return (
    <>
      <PageHeader
        title="My profile"
        description="You can update your contact details yourself. Other details are kept by your cooperative."
        actions={<MemberStatusBadge status={member.lifecycle_status as LifecycleStatus} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details I can change</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            />
            <FormField
              label="Email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            />
            <FormField
              label="Home address"
              value={form.residential_address}
              onChange={(v) => setForm((f) => ({ ...f, residential_address: v }))}
            />
            <FormField
              label="City"
              value={form.city}
              onChange={(v) => setForm((f) => ({ ...f, city: v }))}
            />
            <FormField
              label="State"
              value={form.state}
              onChange={(v) => setForm((f) => ({ ...f, state: v }))}
            />
            <div className="sm:col-span-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kept by my cooperative</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ReadOnly
              label="Membership number"
              value={member.member_number ?? member.membership_number}
            />
            <ReadOnly label="First name" value={member.first_name} />
            <ReadOnly label="Last name" value={member.last_name} />
            <ReadOnly label="Date of birth" value={formatDate(member.date_of_birth)} />
            <ReadOnly label="Employer" value={member.employer} />
            <ReadOnly label="Staff number" value={member.staff_number} />
            <ReadOnly label="Joined" value={formatDate(member.join_date)} />
            <p className="text-xs text-muted-foreground sm:col-span-2">
              To change any of these, contact your cooperative's secretary — the change must be
              verified.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bank accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(banks.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No bank account on file yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(banks.data ?? []).map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded-md border p-3">
                    <span>
                      {b.bank_name} · {maskAccountNumber(b.account_number)}
                    </span>
                    <Badge variant="outline">{b.change_status}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                label="Bank name"
                value={bankForm.bank_name}
                onChange={(v) => setBankForm((f) => ({ ...f, bank_name: v }))}
              />
              <FormField
                label="Account number"
                value={bankForm.account_number}
                onChange={(v) => setBankForm((f) => ({ ...f, account_number: v }))}
              />
              <FormField
                label="Account name"
                value={bankForm.account_name}
                onChange={(v) => setBankForm((f) => ({ ...f, account_name: v }))}
              />
              <FormField
                label="Reason for the change"
                value={bankForm.reason}
                onChange={(v) => setBankForm((f) => ({ ...f, reason: v }))}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => requestBankChange.mutate()}
              disabled={requestBankChange.isPending}
            >
              {requestBankChange.isPending ? "Sending…" : "Request bank change"}
            </Button>
            <p className="text-xs text-muted-foreground">
              A new account is only used after an officer approves it.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">My documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="doc-type">Document type</Label>
              <select
                id="doc-type"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="file"
              className="block text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
              }}
            />
            {(documents.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(documents.data ?? []).map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-md border p-3">
                    <span>
                      {d.document_type} · {d.file_name}
                    </span>
                    <Badge variant="outline">{d.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Leaving the cooperative</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={3}
            value={exitReason}
            onChange={(e) => setExitReason(e.target.value)}
            placeholder="Tell your cooperative why you wish to leave"
          />
          <Button
            variant="outline"
            onClick={() => requestExit.mutate()}
            disabled={requestExit.isPending || !exitReason.trim()}
          >
            {requestExit.isPending ? "Sending…" : "Request to exit"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Your request goes to the cooperative for approval. Nothing changes until they complete
            it.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function FormField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}
