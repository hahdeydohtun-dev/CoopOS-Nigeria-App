/**
 * Helpers for the accounting exceptions screen.
 *
 * The exception engine itself lives in the database (`post_accounting_event()` raises rows in
 * `accounting_exceptions`; `retry_accounting_exception()` re-attempts them). Nothing here posts
 * anything. This module only decides how to describe an exception and where a link can safely go.
 *
 * No imports on purpose: plain TypeScript, usable without the app.
 */

export type ExceptionStatus = "OPEN" | "RESOLVED" | "IGNORED";

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  SAVINGS_TRANSACTION: "Savings transaction",
  LOAN_TRANSACTION: "Loan transaction",
  CHECKOFF_SETTLEMENT: "Check-off settlement",
  WITHDRAWAL_REQUEST: "Withdrawal request",
};

/** Source types the accounting engine raises exceptions for today (see the posting triggers). */
export const KNOWN_SOURCE_TYPES = Object.keys(SOURCE_TYPE_LABELS);

/**
 * `retry_accounting_exception()` can re-post these source types. For any other source type it
 * raises "This exception must be resolved through its own module." This list only decides whether
 * the Retry button is offered; the RPC stays the authority and its message is shown if it refuses.
 */
export const RETRYABLE_SOURCE_TYPES = ["SAVINGS_TRANSACTION", "LOAN_TRANSACTION"];

export function isRetryable(sourceType: string | null | undefined): boolean {
  return Boolean(sourceType && RETRYABLE_SOURCE_TYPES.includes(sourceType));
}

export type ListTarget = "/admin/savings/transactions" | "/admin/loans/book" | "/admin/checkoff";

export type SourceLink =
  | { kind: "withdrawal"; withdrawalId: string }
  | { kind: "list"; to: ListTarget; label: string; note: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where the originating operational record can be opened. Only a withdrawal request has a page
 * addressed by the same id the exception stores. Everything else can only be sent to the module's
 * list, and says so. Unknown source types get no link at all.
 */
export function sourceLink(
  sourceType: string | null | undefined,
  sourceId: string | null | undefined,
): SourceLink | null {
  switch (sourceType) {
    case "WITHDRAWAL_REQUEST":
      return sourceId && UUID.test(sourceId)
        ? { kind: "withdrawal", withdrawalId: sourceId }
        : null;
    case "SAVINGS_TRANSACTION":
      return {
        kind: "list",
        to: "/admin/savings/transactions",
        label: "Open savings transactions",
        note: "Individual savings transactions have no page of their own; search the list by the source ID.",
      };
    case "LOAN_TRANSACTION":
      return {
        kind: "list",
        to: "/admin/loans/book",
        label: "Open the loan book",
        note: "Individual loan transactions have no page of their own; find the loan in the book.",
      };
    case "CHECKOFF_SETTLEMENT":
      return {
        kind: "list",
        to: "/admin/checkoff",
        label: "Open check-off",
        note: "The exception stores the settlement ID, not its batch, so the batch cannot be opened directly.",
      };
    default:
      return null;
  }
}

/** Reads `details.member_id` if the engine stored one; anything that is not a UUID is ignored. */
export function memberIdFromDetails(details: unknown): string | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const value = (details as Record<string, unknown>)["member_id"];
  return typeof value === "string" && UUID.test(value) ? value : null;
}

/** The scalar entries of `details`, for display. Nested values and nulls are left out. */
export function detailEntries(details: unknown): { key: string; value: string }[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  return Object.entries(details as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .map(([key, v]) => ({ key, value: String(v) }));
}

export type RetryOutcome =
  /** RPC failed (permission, unsupported source type, database error). Nothing was posted. */
  | "FAILED"
  /** RPC returned no journal: the engine could not post again. The exception stays open. */
  | "NOT_POSTED"
  /** A journal exists and the exception is now RESOLVED. */
  | "RESOLVED"
  /** RPC returned a journal id but the exception is still OPEN (see note in the screen). */
  | "POSTED_STILL_OPEN"
  /** RPC returned a journal id but the follow-up read failed, so the status is unconfirmed. */
  | "POSTED_UNCONFIRMED";

/**
 * Classifies a retry from what the database actually reported: the RPC result (journal id or
 * error) and the exception row re-read afterwards. `refreshedStatus` is undefined if that
 * re-read failed.
 */
export function classifyRetry(input: {
  error: boolean;
  journalId: string | null;
  refreshedStatus: ExceptionStatus | undefined;
}): RetryOutcome {
  if (input.error) return "FAILED";
  if (input.refreshedStatus === "RESOLVED") return "RESOLVED";
  if (input.journalId) {
    return input.refreshedStatus === undefined ? "POSTED_UNCONFIRMED" : "POSTED_STILL_OPEN";
  }
  return "NOT_POSTED";
}

export const RETRY_OUTCOME_TEXT: Record<RetryOutcome, string> = {
  FAILED: "The retry failed. Nothing was posted.",
  NOT_POSTED:
    "Still failed. The engine could not post this event again, so the exception stays open. Check the posting mappings and the accounting period, then retry once.",
  RESOLVED: "Posted. The exception was resolved automatically.",
  POSTED_STILL_OPEN:
    "A journal exists for this source, but the exception record is still marked open. Nothing was changed on the ledger; review the journal before taking further action.",
  POSTED_UNCONFIRMED:
    "A journal was returned, but the exception could not be re-read to confirm its status. Refresh the page.",
};
