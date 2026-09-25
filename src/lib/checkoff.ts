import type { Database } from "@/integrations/supabase/types";

type Enums = Database["public"]["Enums"];

export type CheckoffBatchStatus = Enums["checkoff_batch_status"];
export type CheckoffSourceType = Enums["checkoff_source_type"];
export type CheckoffMatchStatus = Enums["checkoff_match_status"];
export type CheckoffDeductionType = Enums["checkoff_deduction_type"];
export type CheckoffPostingStatus = Enums["checkoff_line_posting_status"];
export type CheckoffExceptionSeverity = Enums["checkoff_exception_severity"];
export type CheckoffSettlementStatus = Enums["checkoff_settlement_status"];

export const SOURCE_TYPES: CheckoffSourceType[] = [
  "PAYROLL_FILE",
  "CSV",
  "EXCEL",
  "API",
  "BANK_ADVICE",
  "MANUAL_ENTRY",
  "PREVIOUS_BATCH_TEMPLATE",
  "OTHER",
];

export const DEDUCTION_TYPES: CheckoffDeductionType[] = [
  "ORDINARY_SAVINGS",
  "SPECIAL_SAVINGS",
  "SHARE_CONTRIBUTION",
  "LOAN_REPAYMENT",
  "INSURANCE",
  "OTHER_DEDUCTION",
];

/** Only these deduction types post into the savings engine. */
export const SAVINGS_DEDUCTION_TYPES: CheckoffDeductionType[] = [
  "ORDINARY_SAVINGS",
  "SPECIAL_SAVINGS",
];

export const SETTLEMENT_STATUSES: CheckoffSettlementStatus[] = [
  "EXPECTED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "VARIANCE",
  "UNIDENTIFIED",
  "RECONCILED",
];

export const TARGET_FIELDS = [
  "employee_id",
  "staff_number",
  "member_number",
  "employee_name",
  "department",
  "deduction_type",
  "deduction_amount",
  "payroll_date",
  "source_reference",
] as const;
export type TargetField = (typeof TARGET_FIELDS)[number];

export const REQUIRED_FIELDS: TargetField[] = ["deduction_amount"];

export function label(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function batchStatusTone(
  status: CheckoffBatchStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "POSTED":
    case "CLOSED":
      return "default";
    case "REJECTED":
    case "FAILED":
    case "REVERSED":
    case "CANCELLED":
      return "destructive";
    case "EXCEPTION_REVIEW":
    case "PARTIALLY_POSTED":
      return "outline";
    default:
      return "secondary";
  }
}

export function matchTone(
  status: CheckoffMatchStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "EXACT_MATCH":
    case "STRONG_MATCH":
    case "MANUAL_MATCH":
      return "default";
    case "POSSIBLE_MATCH":
      return "outline";
    case "UNMATCHED":
    case "MULTIPLE_MATCHES":
    case "REJECTED":
      return "destructive";
    default:
      return "secondary";
  }
}

/** Statuses a batch may legally move to next. */
export function nextBatchStatuses(current: CheckoffBatchStatus): CheckoffBatchStatus[] {
  switch (current) {
    case "DRAFT":
    case "UPLOADED":
      return ["VALIDATION_COMPLETE", "CANCELLED"];
    case "VALIDATION_COMPLETE":
      return ["EXCEPTION_REVIEW", "READY_FOR_APPROVAL", "CANCELLED"];
    case "EXCEPTION_REVIEW":
      return ["READY_FOR_APPROVAL", "REJECTED", "CANCELLED"];
    case "READY_FOR_APPROVAL":
      return ["CHECKED", "REJECTED"];
    case "CHECKED":
      return ["APPROVED", "REJECTED"];
    case "APPROVED":
      return ["POSTED", "PARTIALLY_POSTED", "REJECTED"];
    case "POSTED":
    case "PARTIALLY_POSTED":
      return ["REVERSED", "CLOSED"];
    default:
      return [];
  }
}

/* ---------------------------------------------------------------- matching */

export type MemberForMatching = {
  id: string;
  member_number: string | null;
  membership_number: string | null;
  staff_number: string | null;
  first_name: string;
  last_name: string;
  other_names: string | null;
  phone: string | null;
  email: string | null;
  lifecycle_status: Enums["member_lifecycle_status"];
};

export type EmploymentForMatching = {
  member_id: string;
  employee_id: string | null;
  department: string | null;
  employment_status: Enums["employment_status_type"];
};

export type PayrollRow = {
  employee_id?: string | null;
  staff_number?: string | null;
  member_number?: string | null;
  employee_name?: string | null;
};

export type MatchResult = {
  memberId: string | null;
  confidence: number;
  basis: string;
  status: CheckoffMatchStatus;
  ambiguous: boolean;
};

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

function nameOf(m: MemberForMatching) {
  return norm([m.first_name, m.other_names, m.last_name].filter(Boolean).join(" "));
}

/** Similarity 0–1 on word overlap, used only as a last resort. */
function nameScore(a: string, b: string): number {
  const aw = new Set(a.split(/\s+/).filter(Boolean));
  const bw = new Set(b.split(/\s+/).filter(Boolean));
  if (aw.size === 0 || bw.size === 0) return 0;
  let hit = 0;
  aw.forEach((w) => {
    if (bw.has(w)) hit += 1;
  });
  return hit / Math.max(aw.size, bw.size);
}

/**
 * Match a payroll row to a member in configurable priority order.
 * Never relies on names alone for a high-confidence match.
 */
export function matchPayrollRow(
  row: PayrollRow,
  members: MemberForMatching[],
  employment: EmploymentForMatching[],
  thresholds: { auto: number; review: number },
): MatchResult {
  const unmatched: MatchResult = {
    memberId: null,
    confidence: 0,
    basis: "No identifier matched",
    status: "UNMATCHED",
    ambiguous: false,
  };

  const decide = (memberId: string, confidence: number, basis: string, ambiguous = false): MatchResult => ({
    memberId,
    confidence,
    basis,
    ambiguous,
    status: ambiguous
      ? "MULTIPLE_MATCHES"
      : confidence >= thresholds.auto
        ? confidence >= 100
          ? "EXACT_MATCH"
          : "STRONG_MATCH"
        : confidence >= thresholds.review
          ? "POSSIBLE_MATCH"
          : "UNMATCHED",
  });

  // 1. Member number
  const mn = norm(row.member_number);
  if (mn) {
    const hits = members.filter(
      (m) => norm(m.member_number) === mn || norm(m.membership_number) === mn,
    );
    if (hits.length > 1) return decide(hits[0]!.id, 100, "Member number (duplicated)", true);
    if (hits.length === 1) return decide(hits[0]!.id, 100, "Member number");
  }

  // 2. Employee / staff id from employment records
  const eid = norm(row.employee_id);
  if (eid) {
    const hits = employment.filter((e) => norm(e.employee_id) === eid);
    if (hits.length > 1) return decide(hits[0]!.member_id, 100, "Employee ID (duplicated)", true);
    if (hits.length === 1) return decide(hits[0]!.member_id, 100, "Employee ID");
  }

  // 3. Staff number held on the member record
  const sn = norm(row.staff_number) || eid;
  if (sn) {
    const hits = members.filter((m) => norm(m.staff_number) === sn);
    if (hits.length > 1) return decide(hits[0]!.id, 95, "Staff number (duplicated)", true);
    if (hits.length === 1) return decide(hits[0]!.id, 95, "Staff number");
  }

  // 4. Name, last resort only
  const rowName = norm(row.employee_name);
  if (rowName) {
    let best: { m: MemberForMatching; score: number } | null = null;
    let tie = false;
    for (const m of members) {
      const score = nameScore(rowName, nameOf(m));
      if (!best || score > best.score) {
        best = { m, score };
        tie = false;
      } else if (best && score === best.score && score > 0) {
        tie = true;
      }
    }
    if (best && best.score >= 0.99 && !tie) return decide(best.m.id, 85, "Exact name");
    if (best && best.score >= 0.6) return decide(best.m.id, Math.round(best.score * 80), "Name similarity", tie);
  }

  return unmatched;
}

/* ------------------------------------------------------------- compliance */

export function complianceFor(
  expected: number | null,
  actual: number,
): Enums["contribution_compliance_status"] {
  if (expected === null || expected === 0) return "NOT_APPLICABLE";
  if (actual <= 0) return "DUE";
  if (actual < expected) return "PARTIALLY_PAID";
  if (actual > expected) return "OVERPAID";
  return "FULLY_PAID";
}

export function friendlyCheckoffError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/row-level security|permission/i.test(message))
    return "You do not have permission to make this change.";
  if (/duplicate key/i.test(message) && /batch_number/i.test(message))
    return "That batch number already exists in this cooperative.";
  if (/duplicate key/i.test(message)) return "A record with those details already exists.";
  if (/posted/i.test(message) && /immutable|cannot be changed/i.test(message))
    return "This has already been posted. Record a reversal instead of changing it.";
  return message || "Something went wrong. Please try again.";
}

/* ------------------------------------------------------------------- CSV */

export type ParsedFile = { headers: string[]; rows: string[][] };

/** Minimal CSV parse that copes with quoted fields. */
export function parseDelimited(text: string): ParsedFile {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]!;
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = !quoted;
      } else if ((ch === "," || ch === "\t" || ch === ";") && !quoted) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = split(lines[0]!);
  const rows = lines.slice(1).map(split);
  return { headers, rows };
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const v = c === null || c === undefined ? "" : String(c);
          return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(","),
    )
    .join("\n");
}

export function downloadCsv(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export const PAYROLL_TEMPLATE =
  "employee_id,staff_number,member_number,employee_name,department,deduction_type,deduction_amount,payroll_date,source_reference\n" +
  "EMP001,STF001,COOP-000001,Ada Okafor,Finance,ORDINARY_SAVINGS,10000,2026-09-25,SEP-PAYROLL";
