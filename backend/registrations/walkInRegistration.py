import json
import logging
import re

from shared.auth import audit, caller_from_event, iso_now
from shared.db import events_table, registrations_table
from shared.ids import new_id, registration_number
from shared.response import bad_request, conflict, cors, ok, server_error

log = logging.getLogger()

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return cors()

    caller = caller_from_event(event)
    event_id = (event.get("pathParameters") or {}).get("eventId")
    if not event_id:
        return bad_request("eventId is required")

    try:
        body = json.loads(event.get("body") or "{}")
    except (ValueError, TypeError):
        return bad_request("Invalid JSON")

    full_name = body.get("fullName")
    organisation = body.get("organisation")
    email = body.get("email")
    phone = body.get("phone")
    position = body.get("position")

    if not full_name or len(full_name.strip()) < 2:
        return bad_request("fullName is required")
    if not organisation or len(organisation.strip()) < 2:
        return bad_request("organisation is required")
    if not email or not EMAIL_RE.match(email.strip()):
        return bad_request("Valid email is required")

    email_norm = email.strip().lower()

    event_item = events_table().get_item(Key={"eventId": event_id}).get("Item")
    if not event_item:
        return bad_request("Event not found")

    existing = registrations_table().query(
        IndexName="email-eventId-index",
        KeyConditionExpression="email = :email AND eventId = :eventId",
        ExpressionAttributeValues={":email": email_norm, ":eventId": event_id},
        Limit=1,
    )
    if existing.get("Items"):
        return conflict("This email is already registered for this event")

    prefix = re.sub(r"\s+", "", event_item.get("name") or "")[:6].upper()
    now = iso_now()
    item = {
        "registrationId": new_id(),
        "eventId": event_id,
        "registrationNumber": registration_number(prefix),
        "fullName": full_name.strip(),
        "organisation": organisation.strip(),
        "email": email_norm,
        "phone": phone.strip() if phone else None,
        "position": position.strip() if position else None,
        "registrationType": "walk_in",
        "checkedInAt": None,
        "checkedInBy": None,
        "badgePrintedAt": None,
        "badgePrintCount": 0,
        "createdBy": caller["actorId"],
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        registrations_table().put_item(Item=item)
        audit("participant.walk_in_registered", entity="participant",
              entity_id=item["registrationId"],
              actor_id=caller["actorId"], actor_label=caller["actorLabel"],
              meta={"name": item["fullName"], "email": item["email"],
                    "phone": item["phone"], "reg": item["registrationNumber"]})
        return ok(item)
    except Exception:
        log.exception("walkInRegistration failed")
        return server_error()
