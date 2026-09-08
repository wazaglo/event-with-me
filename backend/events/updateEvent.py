import json
import logging

from shared.auth import audit, caller_from_event, is_admin, iso_now
from shared.db import events_table
from shared.response import bad_request, cors, forbidden, not_found, ok, server_error

log = logging.getLogger()

ALLOWED = ["name", "date", "venue", "description", "registrationOpen", "primaryColor",
           "accentColor", "logoUrl", "showQr", "showRegistrationNumber", "badgeFontSize"]


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return cors()

    caller = caller_from_event(event)
    if not is_admin(caller["groups"]):
        return forbidden()

    event_id = (event.get("pathParameters") or {}).get("eventId")
    if not event_id:
        return bad_request("eventId is required")

    try:
        body = json.loads(event.get("body") or "{}")
    except (ValueError, TypeError):
        return bad_request("Invalid JSON")

    try:
        existing = events_table().get_item(Key={"eventId": event_id}).get("Item")
        if not existing:
            return not_found("Event not found")

        updates = {k: body[k] for k in ALLOWED if k in body}
        updates["updatedAt"] = iso_now()

        expr_names = {f"#{k}": k for k in updates}
        expr_values = {f":{k}": v for k, v in updates.items()}
        set_expr = ", ".join(f"#{k} = :{k}" for k in updates)

        events_table().update_item(
            Key={"eventId": event_id},
            UpdateExpression=f"SET {set_expr}",
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
        )
        audit("event.updated", entity="event", entity_id=event_id,
              actor_id=caller["actorId"], actor_label=caller["actorLabel"])
        return ok({**updates, "eventId": event_id})
    except Exception:
        log.exception("updateEvent failed")
        return server_error()
