import json
import logging

from shared.auth import audit, caller_from_event, is_admin, iso_now
from shared.db import events_table
from shared.ids import new_id
from shared.response import bad_request, cors, created, forbidden, server_error, with_cors

log = logging.getLogger()


@with_cors
def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return cors()

    caller = caller_from_event(event)
    if not is_admin(caller["groups"]):
        return forbidden()

    try:
        body = json.loads(event.get("body") or "{}")
    except (ValueError, TypeError):
        return bad_request("Invalid JSON")

    name = body.get("name")
    if not name or not isinstance(name, str) or len(name.strip()) < 2:
        return bad_request("name is required (min 2 chars)")

    now = iso_now()
    item = {
        "eventId": new_id(),
        "name": name.strip(),
        "date": body.get("date"),
        "venue": body.get("venue"),
        "description": body.get("description"),
        "registrationOpen": body.get("registrationOpen", True),
        "primaryColor": body.get("primaryColor") or "#00655b",
        "accentColor": body.get("accentColor") or "#ffd400",
        "logoUrl": body.get("logoUrl"),
        "showQr": body.get("showQr", True),
        "showRegistrationNumber": body.get("showRegistrationNumber", True),
        "badgeFontSize": body.get("badgeFontSize", 16),
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        events_table().put_item(Item=item)
        audit("event.created", entity="event", entity_id=item["eventId"],
              actor_id=caller["actorId"], actor_label=caller["actorLabel"],
              meta={"name": item["name"]})
        return created(item)
    except Exception:
        log.exception("createEvent failed")
        return server_error()
