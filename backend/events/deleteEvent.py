import logging

from shared.auth import audit, caller_from_event, is_admin
from shared.db import events_table
from shared.response import bad_request, cors, forbidden, not_found, ok, server_error, with_cors

log = logging.getLogger()


@with_cors
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
        existing = events_table().get_item(Key={"eventId": event_id}).get("Item")
        if not existing:
            return not_found("Event not found")

        events_table().delete_item(Key={"eventId": event_id})
        audit("event.deleted", entity="event", entity_id=event_id,
              actor_id=caller["actorId"], actor_label=caller["actorLabel"],
              meta={"name": existing.get("name")})
        return ok({"deleted": True, "eventId": event_id})
    except Exception:
        log.exception("deleteEvent failed")
        return server_error()
