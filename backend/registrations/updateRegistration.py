import json
import logging

from shared.auth import audit, caller_from_event, iso_now
from shared.db import registrations_table
from shared.response import bad_request, cors, not_found, ok, server_error, with_cors

log = logging.getLogger()

ALLOWED = ["fullName", "organisation", "email", "phone", "position"]


@with_cors
def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return cors()

    caller = caller_from_event(event)
    reg_id = (event.get("pathParameters") or {}).get("id")
    if not reg_id:
        return bad_request("id is required")

    try:
        body = json.loads(event.get("body") or "{}")
    except (ValueError, TypeError):
        return bad_request("Invalid JSON")

    try:
        existing = registrations_table().get_item(Key={"registrationId": reg_id}).get("Item")
        if not existing:
            return not_found("Registration not found")

        updates = {k: body[k] for k in ALLOWED if k in body}
        updates["updatedAt"] = iso_now()

        expr_names = {f"#{k}": k for k in updates}
        expr_values = {f":{k}": v for k, v in updates.items()}
        set_expr = ", ".join(f"#{k} = :{k}" for k in updates)

        registrations_table().update_item(
            Key={"registrationId": reg_id},
            UpdateExpression=f"SET {set_expr}",
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
            ReturnValues="ALL_NEW",
        )
        audit("participant.edited", entity="participant", entity_id=reg_id,
              actor_id=caller["actorId"], actor_label=caller["actorLabel"])
        return ok({**updates, "registrationId": reg_id})
    except Exception:
        log.exception("updateRegistration failed")
        return server_error()
