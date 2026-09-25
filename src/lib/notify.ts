import { supabase } from "@/integrations/supabase/client";

export type StaffAlertSeverity = "INFO" | "ACTION" | "WARNING";

/**
 * Staff-facing alert for a cooperative (payroll, treasury, admin users).
 * Notifications must never block the action that produced them, so failures
 * are swallowed — the underlying record is already written and audited.
 */
export async function notifyStaff(input: {
  cooperativeId: string;
  eventType: string;
  title: string;
  body?: string;
  link?: string;
  severity?: StaffAlertSeverity;
}) {
  try {
    await supabase.from("staff_notifications").insert({
      cooperative_id: input.cooperativeId,
      event_type: input.eventType,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      severity: input.severity ?? "INFO",
    });
  } catch {
    /* alerts are best-effort */
  }
}

/** Member-facing notifications, one row per member. */
export async function notifyMembers(
  cooperativeId: string,
  memberIds: string[],
  notice: { eventType: string; title: string; body?: string },
) {
  const unique = Array.from(new Set(memberIds.filter(Boolean)));
  if (unique.length === 0) return;
  try {
    await supabase.from("member_notifications").insert(
      unique.map((memberId) => ({
        cooperative_id: cooperativeId,
        member_id: memberId,
        event_type: notice.eventType,
        title: notice.title,
        body: notice.body ?? null,
      })) as never,
    );
  } catch {
    /* alerts are best-effort */
  }
}
