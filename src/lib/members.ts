import type { Database } from "@/integrations/supabase/types";

export type LifecycleStatus = Database["public"]["Enums"]["member_lifecycle_status"];
export type DocumentStatus = Database["public"]["Enums"]["member_document_status"];
export type EmploymentStatus = Database["public"]["Enums"]["employment_status_type"];
export type NoteCategory = Database["public"]["Enums"]["member_note_category"];

export const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  "PROSPECTIVE",
  "PENDING_VERIFICATION",
  "PENDING_APPROVAL",
  "ACTIVE",
  "SUSPENDED",
  "DORMANT",
  "REACTIVATION_PENDING",
  "RETIRED",
  "EXIT_PENDING",
  "EXITED",
  "DECEASED",
  "BLACKLISTED",
];

export const statusLabel: Record<LifecycleStatus, string> = {
  PROSPECTIVE: "Prospective",
  PENDING_VERIFICATION: "Pending verification",
  PENDING_APPROVAL: "Pending approval",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  DORMANT: "Dormant",
  REACTIVATION_PENDING: "Reactivation pending",
  RETIRED: "Retired",
  EXIT_PENDING: "Exit pending",
  EXITED: "Exited",
  DECEASED: "Deceased",
  BLACKLISTED: "Blacklisted",
};

export type BadgeTone = "default" | "secondary" | "outline" | "destructive";

export const statusTone: Record<LifecycleStatus, BadgeTone> = {
  PROSPECTIVE: "outline",
  PENDING_VERIFICATION: "outline",
  PENDING_APPROVAL: "outline",
  ACTIVE: "secondary",
  SUSPENDED: "destructive",
  DORMANT: "outline",
  REACTIVATION_PENDING: "outline",
  RETIRED: "outline",
  EXIT_PENDING: "outline",
  EXITED: "outline",
  DECEASED: "outline",
  BLACKLISTED: "destructive",
};

/** Mirrors the database rule. Keeps the UI from offering impossible actions. */
const TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  PROSPECTIVE: ["PENDING_VERIFICATION", "EXITED"],
  PENDING_VERIFICATION: ["PENDING_APPROVAL", "PROSPECTIVE", "EXITED"],
  PENDING_APPROVAL: ["ACTIVE", "PENDING_VERIFICATION", "EXITED"],
  ACTIVE: ["SUSPENDED", "DORMANT", "RETIRED", "EXIT_PENDING"],
  SUSPENDED: ["ACTIVE", "EXIT_PENDING", "DORMANT"],
  DORMANT: ["REACTIVATION_PENDING", "EXIT_PENDING"],
  REACTIVATION_PENDING: ["ACTIVE", "DORMANT"],
  RETIRED: ["EXIT_PENDING", "ACTIVE"],
  EXIT_PENDING: ["EXITED", "ACTIVE"],
  EXITED: [],
  DECEASED: [],
  BLACKLISTED: [],
};

export function allowedTransitions(from: LifecycleStatus | null | undefined): LifecycleStatus[] {
  if (!from) return [];
  const base = TRANSITIONS[from] ?? [];
  const terminal: LifecycleStatus[] = ["DECEASED", "BLACKLISTED"];
  const extra = ["EXITED", "DECEASED", "BLACKLISTED"].includes(from) ? [] : terminal;
  return Array.from(new Set([...base, ...extra]));
}

/** Human wording for the action button that produces each status. */
export const transitionLabel: Partial<Record<LifecycleStatus, string>> = {
  PENDING_VERIFICATION: "Submit for verification",
  PENDING_APPROVAL: "Mark as verified",
  ACTIVE: "Approve / activate",
  SUSPENDED: "Suspend",
  DORMANT: "Mark dormant",
  REACTIVATION_PENDING: "Request reactivation",
  RETIRED: "Retire",
  EXIT_PENDING: "Start exit",
  EXITED: "Complete exit",
  DECEASED: "Record as deceased",
  BLACKLISTED: "Blacklist",
  PROSPECTIVE: "Return to draft",
};

export function maskAccountNumber(value: string | null | undefined): string {
  if (!value) return "—";
  const clean = value.replace(/\s+/g, "");
  if (clean.length <= 4) return clean;
  return `${"*".repeat(Math.max(clean.length - 4, 4))}${clean.slice(-4)}`;
}

export function fullName(m: {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  other_names?: string | null;
}): string {
  return [m.first_name, m.middle_name ?? m.other_names, m.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Turns a database error into something a cooperative officer can act on. */
export function friendlyError(error: unknown): string {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  console.error("[members]", error);
  if (message.includes("duplicate key value violates unique constraint")) {
    if (message.includes("member_number")) {
      return "Member number already exists. Please use another member number.";
    }
    return "That record already exists. Please check for a duplicate entry.";
  }
  if (message.includes("Next of kin allocation")) {
    return "Next of kin allocations cannot add up to more than 100%.";
  }
  if (message.includes("row-level security")) {
    return "You do not have permission to make this change.";
  }
  if (message.startsWith("Cannot move a member")) {
    return "That status change is not allowed from the member's current status.";
  }
  if (message.includes("reason is required")) {
    return "Please give a reason for this change.";
  }
  return message || "Something went wrong. Please try again.";
}

export const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  "EMPLOYED",
  "SELF_EMPLOYED",
  "RETIRED",
  "RESIGNED",
  "TERMINATED",
  "DECEASED",
  "OTHER",
];

export const DOCUMENT_TYPES = [
  "Passport photograph",
  "Means of identification",
  "Proof of employment",
  "Bank statement",
  "Signed application form",
  "Other",
];

export const NOTE_CATEGORIES: NoteCategory[] = [
  "GENERAL",
  "MEMBERSHIP",
  "COMPLIANCE",
  "EMPLOYMENT",
  "LOAN",
  "PAYROLL",
  "OTHER",
];

export const PAGE_SIZES = [25, 50, 100];

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Accepts 0803..., +23480..., 23480... */
export function isValidNigerianPhone(value: string): boolean {
  const clean = value.replace(/[\s-]/g, "");
  return /^(\+?234|0)\d{10}$/.test(clean) || /^\+?\d{8,15}$/.test(clean);
}
