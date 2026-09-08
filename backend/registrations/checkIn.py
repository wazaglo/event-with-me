import logging

from shared.auth import audit, caller_from_event, iso_now
from shared.db import registrations_table
from shared.response import bad_request, cors, not_found, ok, server_error, with_cors

log = logging.getLogger()


@with_cors
def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return cors()

    caller = caller_from_event(event)
    reg_id = (event.get("pathParameters") or {}).get("id")
    if not reg_id:
        return bad_request("id is required")

    try:
        existing = registrations_table().get_item(Key={"registrationId": reg_id}).get("Item")
        if not existing:
            return not_found("Registration not found")
        if existing.get("checkedInAt"):
            return ok({**existing, "alreadyCheckedIn": True})

        now = iso_now()
        registrations_table().update_item(
            Key={"registrationId": reg_id},
            UpdateExpression="SET checkedInAt = :t, checkedInBy = :by, updatedAt = :t",
            ExpressionAttributeValues={":t": now, ":by": caller["actorId"] or "system"},
        )
        audit("participant.checked_in", entity="participant", entity_id=reg_id,
              actor_id=caller["actorId"], actor_label=caller["actorLabel"],
              meta={"name": existing.get("fullName"), "email": existing.get("email"),
                    "phone": existing.get("phone")})
        return ok({**existing, "checkedInAt": now, "checkedInBy": caller["actorId"]})
    except Exception:
        log.exception("checkIn failed")
        return server_error()
