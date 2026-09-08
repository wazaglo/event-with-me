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

        now = iso_now()
        new_count = int(existing.get("badgePrintCount") or 0) + 1

        registrations_table().update_item(
            Key={"registrationId": reg_id},
            UpdateExpression="SET badgePrintedAt = :t, badgePrintCount = :c, updatedAt = :t",
            ExpressionAttributeValues={":t": now, ":c": new_count},
        )
        audit("badge.printed", entity="participant", entity_id=reg_id,
              actor_id=caller["actorId"], actor_label=caller["actorLabel"])
        return ok({"badgePrintedAt": now, "badgePrintCount": new_count})
    except Exception:
        log.exception("printBadge failed")
        return server_error()
