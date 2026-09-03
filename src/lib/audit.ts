import { getSession } from "@/lib/auth/cognito-client";
import { auditApi } from "@/lib/api-client";

export type AuditAction =
  | "participant.registered"
  | "participant.walk_in_registered"
  | "participant.edited"
  | "participant.deleted"
  | "participant.checked_in"
  | "badge.printed"
  | "user.login"
  | "user.logout"
  | "staff.created"
  | "staff.role_changed"
  | "staff.disabled"
  | "staff.password_reset"
  | "settings.updated"
  | "event.created"
  | "event.updated";

// Client-side audit logging is now a best-effort fire-and-forget.
// The Lambda functions also write audit entries server-side for all mutations.
export async function logAudit(
  _action: AuditAction,
  _opts: { entity?: string; entity_id?: string | null; meta?: Record<string, unknown> } = {},
) {
  // Server-side audit is handled by Lambda. This is a no-op kept for
  // call-site compatibility during the migration.
}
