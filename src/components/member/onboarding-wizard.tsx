import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  DOCUMENT_TYPES,
  EMPLOYMENT_STATUSES,
  friendlyError,
  isValidEmail,
  isValidNigerianPhone,
  titleCaseStatus,
} from "@/components/member/wizard-helpers";

type Draft = {
  title: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  preferred_name: string;
  gender: string;
  date_of_birth: string;
  marital_status: string;
  nationality: string;
  phone: string;
  email: string;
  residential_address: string;
  city: string;
  state: string;
  country: string;
  member_number: string;
  join_date: string;
  branch_id: string;
  // employment
  employer_name: string;
  department: string;
  designation: string;
  employee_id: string;
  grade_level: string;
  employment_type: string;
  employment_status: string;
  date_employed: string;
  payroll_frequency: string;
  // bank
  bank_name: string;
  account_number: string;
  account_name: string;
  account_type: string;
  // next of kin
  nok_name: string;
  nok_relationship: string;
  nok_phone: string;
  nok_email: string;
  nok_address: string;
  // membership
  category_id: string;
  membership_type: string;
  // declarations
  declaration_accepted: boolean;
  data_consent: boolean;
};

const emptyDraft: Draft = {
  title: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  preferred_name: "",
  gender: "",
  date_of_birth: "",
  marital_status: "",
  nationality: "Nigerian",
  phone: "",
  email: "",
  residential_address: "",
  city: "",
  state: "",
  country: "Nigeria",
  member_number: "",
  join_date: new Date().toISOString().slice(0, 10),
  branch_id: "",
  employer_name: "",
  department: "",
  designation: "",
  employee_id: "",
  grade_level: "",
  employment_type: "",
  employment_status: "EMPLOYED",
  date_employed: "",
  payroll_frequency: "MONTHLY",
  bank_name: "",
  account_number: "",
  account_name: "",
  account_type: "Savings",
  nok_name: "",
  nok_relationship: "",
  nok_phone: "",
  nok_email: "",
  nok_address: "",
  category_id: "",
  membership_type: "STANDARD",
  declaration_accepted: false,
  data_consent: false,
};

const STEPS = [
  "Personal",
  "Employment",
  "Bank",
  "Next of kin",
  "Documents",
  "Category",
  "Declarations",
  "Review",
];

const STORAGE_KEY = "coopos.member-onboarding-draft";

export function OnboardingWizard({ cooperativeId }: { cooperativeId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<{ type: string; file: File }[]>([]);
  const [draft, setDraft] = useState<Draft>(() => {
    if (typeof window === "undefined") return emptyDraft;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? { ...emptyDraft, ...(JSON.parse(saved) as Partial<Draft>) } : emptyDraft;
    } catch {
      return emptyDraft;
    }
  });

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* saving the draft is best effort */
      }
      return next;
    });
  }

  const branches = useQuery({
    queryKey: ["branches", cooperativeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .eq("cooperative_id", cooperativeId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const categories = useQuery({
    queryKey: ["membership-categories", cooperativeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_categories")
        .select("id, name, code")
        .eq("cooperative_id", cooperativeId)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const errors = useMemo(() => validate(step, draft), [step, draft]);

  const submit = useMutation({
    mutationFn: async () => {
      let memberNumber = draft.member_number.trim();
      if (!memberNumber) {
        const { data, error } = await supabase.rpc("next_member_number", {
          _cooperative_id: cooperativeId,
        });
        if (error) throw error;
        memberNumber = data as string;
      }

      const { data: member, error: memberError } = await supabase
        .from("members")
        .insert({
          cooperative_id: cooperativeId,
          branch_id: draft.branch_id || null,
          member_number: memberNumber,
          membership_number: memberNumber,
          title: draft.title || null,
          first_name: draft.first_name.trim(),
          middle_name: draft.middle_name || null,
          last_name: draft.last_name.trim(),
          preferred_name: draft.preferred_name || null,
          gender: draft.gender || null,
          date_of_birth: draft.date_of_birth || null,
          marital_status: draft.marital_status || null,
          nationality: draft.nationality || null,
          phone: draft.phone || null,
          email: draft.email || null,
          residential_address: draft.residential_address || null,
          city: draft.city || null,
          state: draft.state || null,
          country: draft.country || "Nigeria",
          employer: draft.employer_name || null,
          staff_number: draft.employee_id || null,
          join_date: draft.join_date,
          lifecycle_status: "PROSPECTIVE",
          status: "PENDING",
        })
        .select("id")
        .single();
      if (memberError) throw memberError;
      const memberId = member.id;

      const { error: membershipError } = await supabase.from("memberships").insert({
        cooperative_id: cooperativeId,
        member_id: memberId,
        membership_number: memberNumber,
        membership_type: draft.membership_type,
        category_id: draft.category_id || null,
        branch_id: draft.branch_id || null,
        department: draft.department || null,
        employee_id: draft.employee_id || null,
        application_date: new Date().toISOString().slice(0, 10),
        status: "PROSPECTIVE",
      });
      if (membershipError) throw membershipError;

      if (draft.employer_name || draft.employee_id) {
        const { error } = await supabase.from("member_employment").insert({
          cooperative_id: cooperativeId,
          member_id: memberId,
          employer_name: draft.employer_name || null,
          department: draft.department || null,
          designation: draft.designation || null,
          employee_id: draft.employee_id || null,
          grade_level: draft.grade_level || null,
          employment_type: draft.employment_type || null,
          employment_status: (draft.employment_status || "EMPLOYED") as never,
          date_employed: draft.date_employed || null,
          payroll_frequency: draft.payroll_frequency || null,
        });
        if (error) throw error;
      }

      if (draft.bank_name && draft.account_number) {
        const { error } = await supabase.from("member_bank_accounts").insert({
          cooperative_id: cooperativeId,
          member_id: memberId,
          bank_name: draft.bank_name,
          account_number: draft.account_number,
          account_name: draft.account_name || `${draft.first_name} ${draft.last_name}`,
          account_type: draft.account_type || null,
          is_primary: true,
          change_status: "PENDING",
        });
        if (error) throw error;
      }

      if (draft.nok_name) {
        const { error } = await supabase.from("member_next_of_kin").insert({
          cooperative_id: cooperativeId,
          member_id: memberId,
          name: draft.nok_name,
          relationship: draft.nok_relationship || null,
          phone: draft.nok_phone || null,
          email: draft.nok_email || null,
          address: draft.nok_address || null,
          percentage: 100,
          is_primary: true,
        });
        if (error) throw error;
      }

      for (const entry of files) {
        const path = `${cooperativeId}/${memberId}/${Date.now()}-${entry.file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("member-documents")
          .upload(path, entry.file);
        if (uploadError) throw uploadError;
        const { error } = await supabase.from("member_documents").insert({
          cooperative_id: cooperativeId,
          member_id: memberId,
          document_type: entry.type,
          file_name: entry.file.name,
          storage_path: path,
          mime_type: entry.file.type || null,
          file_size: entry.file.size,
          status: "UPLOADED",
        });
        if (error) throw error;
      }

      const { error: statusError } = await supabase.rpc("change_member_status", {
        _member_id: memberId,
        _new_status: "PENDING_VERIFICATION",
        _reason: "Membership application submitted",
        _effective_date: new Date().toISOString().slice(0, 10),
      });
      if (statusError) throw statusError;

      await supabase.from("member_notifications").insert({
        cooperative_id: cooperativeId,
        member_id: memberId,
        event_type: "MEMBERSHIP_SUBMITTED",
        title: "Membership application submitted",
        body: "The application is now awaiting verification.",
      });

      return memberId;
    },
    onSuccess: (memberId) => {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      toast.success("Application submitted and sent for verification.");
      void queryClient.invalidateQueries();
      void navigate({ to: "/admin/members/$memberId", params: { memberId } });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="text-base">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </CardTitle>
        <Progress value={((step + 1) / STEPS.length) * 100} />
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" value={draft.title} onChange={(v) => set("title", v)} />
            <Field
              label="First name *"
              value={draft.first_name}
              onChange={(v) => set("first_name", v)}
            />
            <Field
              label="Middle name"
              value={draft.middle_name}
              onChange={(v) => set("middle_name", v)}
            />
            <Field
              label="Last name *"
              value={draft.last_name}
              onChange={(v) => set("last_name", v)}
            />
            <Field
              label="Preferred name"
              value={draft.preferred_name}
              onChange={(v) => set("preferred_name", v)}
            />
            <Choice
              label="Gender"
              value={draft.gender}
              options={["Male", "Female"]}
              onChange={(v) => set("gender", v)}
            />
            <Field
              label="Date of birth"
              type="date"
              value={draft.date_of_birth}
              onChange={(v) => set("date_of_birth", v)}
            />
            <Choice
              label="Marital status"
              value={draft.marital_status}
              options={["Single", "Married", "Divorced", "Widowed"]}
              onChange={(v) => set("marital_status", v)}
            />
            <Field label="Phone *" value={draft.phone} onChange={(v) => set("phone", v)} />
            <Field
              label="Email"
              type="email"
              value={draft.email}
              onChange={(v) => set("email", v)}
            />
            <Field label="City" value={draft.city} onChange={(v) => set("city", v)} />
            <Field label="State" value={draft.state} onChange={(v) => set("state", v)} />
            <Field label="Country" value={draft.country} onChange={(v) => set("country", v)} />
            <Field
              label="Nationality"
              value={draft.nationality}
              onChange={(v) => set("nationality", v)}
            />
            <div className="sm:col-span-2">
              <Label htmlFor="addr">Residential address</Label>
              <Textarea
                id="addr"
                value={draft.residential_address}
                onChange={(e) => set("residential_address", e.target.value)}
                rows={2}
              />
            </div>
            <Field
              label="Member number (leave blank to generate)"
              value={draft.member_number}
              onChange={(v) => set("member_number", v)}
            />
            <Field
              label="Join date"
              type="date"
              value={draft.join_date}
              onChange={(v) => set("join_date", v)}
            />
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Employer"
              value={draft.employer_name}
              onChange={(v) => set("employer_name", v)}
            />
            <Field
              label="Department"
              value={draft.department}
              onChange={(v) => set("department", v)}
            />
            <Field
              label="Designation"
              value={draft.designation}
              onChange={(v) => set("designation", v)}
            />
            <Field
              label="Employee / staff number"
              value={draft.employee_id}
              onChange={(v) => set("employee_id", v)}
            />
            <Field
              label="Grade level"
              value={draft.grade_level}
              onChange={(v) => set("grade_level", v)}
            />
            <Choice
              label="Employment type"
              value={draft.employment_type}
              options={["Permanent", "Contract", "Temporary", "Retired"]}
              onChange={(v) => set("employment_type", v)}
            />
            <Choice
              label="Employment status"
              value={draft.employment_status}
              options={EMPLOYMENT_STATUSES}
              display={titleCaseStatus}
              onChange={(v) => set("employment_status", v)}
            />
            <Field
              label="Date employed"
              type="date"
              value={draft.date_employed}
              onChange={(v) => set("date_employed", v)}
            />
            <Choice
              label="Payroll frequency"
              value={draft.payroll_frequency}
              options={["MONTHLY", "WEEKLY", "BI_WEEKLY"]}
              display={titleCaseStatus}
              onChange={(v) => set("payroll_frequency", v)}
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank" value={draft.bank_name} onChange={(v) => set("bank_name", v)} />
            <Field
              label="Account number"
              value={draft.account_number}
              onChange={(v) => set("account_number", v)}
            />
            <Field
              label="Account name"
              value={draft.account_name}
              onChange={(v) => set("account_name", v)}
            />
            <Choice
              label="Account type"
              value={draft.account_type}
              options={["Savings", "Current"]}
              onChange={(v) => set("account_type", v)}
            />
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Bank details are recorded as unverified until an authorised officer confirms them.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" value={draft.nok_name} onChange={(v) => set("nok_name", v)} />
            <Field
              label="Relationship"
              value={draft.nok_relationship}
              onChange={(v) => set("nok_relationship", v)}
            />
            <Field label="Phone" value={draft.nok_phone} onChange={(v) => set("nok_phone", v)} />
            <Field label="Email" value={draft.nok_email} onChange={(v) => set("nok_email", v)} />
            <div className="sm:col-span-2">
              <Label htmlFor="nok-addr">Address</Label>
              <Textarea
                id="nok-addr"
                value={draft.nok_address}
                onChange={(e) => set("nok_address", e.target.value)}
                rows={2}
              />
            </div>
            <p className="text-sm text-muted-foreground sm:col-span-2">
              More next of kin can be added from the member's record after submission.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {DOCUMENT_TYPES.map((type) => (
                <div key={type} className="space-y-1">
                  <Label htmlFor={`doc-${type}`}>{type}</Label>
                  <Input
                    id={`doc-${type}`}
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setFiles((prev) => [
                        ...prev.filter((f) => f.type !== type),
                        ...(file ? [{ type, file }] : []),
                      ]);
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Documents are stored privately and can only be opened by the member and authorised
              officers.
            </p>
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Membership category</Label>
              <Select
                value={draft.category_id}
                onValueChange={(v) => set("category_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {(categories.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Branch</Label>
              <Select value={draft.branch_id} onValueChange={(v) => set("branch_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {(branches.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={draft.declaration_accepted}
                onCheckedChange={(v) => set("declaration_accepted", v === true)}
              />
              <span>
                I declare that the information provided is true and complete, and I agree to abide
                by the bye-laws of the cooperative society.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={draft.data_consent}
                onCheckedChange={(v) => set("data_consent", v === true)}
              />
              <span>
                I consent to the cooperative society holding and processing this information for
                membership administration.
              </span>
            </label>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4 text-sm">
            <Summary title="Personal">
              {`${draft.title} ${draft.first_name} ${draft.middle_name} ${draft.last_name}`.trim()}
              {draft.phone ? ` · ${draft.phone}` : ""}
              {draft.email ? ` · ${draft.email}` : ""}
            </Summary>
            <Summary title="Employment">
              {[draft.employer_name, draft.department, draft.designation, draft.employee_id]
                .filter(Boolean)
                .join(" · ") || "Not provided"}
            </Summary>
            <Summary title="Bank">
              {draft.bank_name
                ? `${draft.bank_name} · ${draft.account_number}`
                : "Not provided"}
            </Summary>
            <Summary title="Next of kin">
              {draft.nok_name
                ? `${draft.nok_name} (${draft.nok_relationship || "relationship not stated"})`
                : "Not provided"}
            </Summary>
            <Summary title="Documents">
              {files.length ? files.map((f) => f.type).join(", ") : "None attached"}
            </Summary>
            <Summary title="Category">
              {(categories.data ?? []).find((c) => c.id === draft.category_id)?.name ??
                "Not selected"}
            </Summary>
            <p className="text-muted-foreground">
              On submission the application moves to <strong>Pending verification</strong>. No
              financial records are created at this point.
            </p>
          </div>
        )}

        {errors.length > 0 && (
          <ul className="space-y-1 text-sm text-destructive">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={errors.length > 0}>
              Continue
            </Button>
          ) : (
            <Button onClick={() => submit.mutate()} disabled={submit.isPending || errors.length > 0}>
              {submit.isPending ? "Submitting…" : "Submit application"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function validate(step: number, draft: Draft): string[] {
  const errors: string[] = [];
  if (step === 0) {
    if (!draft.first_name.trim()) errors.push("First name is required.");
    if (!draft.last_name.trim()) errors.push("Last name is required.");
    if (!draft.phone.trim()) errors.push("Phone number is required.");
    else if (!isValidNigerianPhone(draft.phone)) errors.push("Enter a valid phone number.");
    if (draft.email && !isValidEmail(draft.email)) errors.push("Enter a valid email address.");
    if (draft.date_of_birth && new Date(draft.date_of_birth) > new Date())
      errors.push("Date of birth cannot be in the future.");
  }
  if (step === 2 && draft.account_number && !/^\d{10}$/.test(draft.account_number.trim())) {
    errors.push("A Nigerian bank account number is 10 digits.");
  }
  if (step === 3 && draft.nok_email && !isValidEmail(draft.nok_email)) {
    errors.push("Enter a valid next-of-kin email address.");
  }
  if (step === 6 && (!draft.declaration_accepted || !draft.data_consent)) {
    errors.push("Both declarations must be accepted before continuing.");
  }
  return errors;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
  display,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  display?: (value: string) => string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {display ? display(o) : o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Summary({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}
