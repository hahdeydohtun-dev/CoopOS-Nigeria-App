export {
  DOCUMENT_TYPES,
  EMPLOYMENT_STATUSES,
  friendlyError,
  isValidEmail,
  isValidNigerianPhone,
} from "@/lib/members";

export function titleCaseStatus(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
