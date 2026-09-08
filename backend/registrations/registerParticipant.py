import json
import logging
import os
import re

import boto3

from shared.auth import audit, iso_now
from shared.db import EVENTS_TABLE, REGISTRATIONS_TABLE, events_table, registrations_table
from shared.ids import new_id, registration_number
from shared.response import bad_request, conflict, cors, not_found, ok, server_error

log = logging.getLogger()

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

_sqs = None


def _sqs_client():
    global _sqs
    if _sqs is None:
        _sqs = boto3.client("sqs")
    return _sqs


def _valid_email(email):
    return bool(EMAIL_RE.match(email))


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return cors()

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
    if not email or not _valid_email(email.strip()):
        return bad_request("Valid email is required")

    email_norm = email.strip().lower()

    # Check event exists and registration is open
    event_item = events_table().get_item(Key={"eventId": event_id}).get("Item")
    if not event_item:
        return not_found("Event not found")
    if not event_item.get("registrationOpen"):
        return bad_request("Registration is currently closed")

    # Check for duplicate email in this event
    existing = registrations_table().query(
        IndexName="email-eventId-index",
        KeyConditionExpression="email = :email AND eventId = :eventId",
        ExpressionAttributeValues={":email": email_norm, ":eventId": event_id},
        Limit=1,
    )
    if existing.get("Items"):
        return conflict("This email is already registered for this event")

    prefix = re.sub(r"\s+", "", event_item.get("name") or "")[:6].upper()
    reg_number = registration_number(prefix)
    now = iso_now()

    item = {
        "registrationId": new_id(),
        "eventId": event_id,
        "registrationNumber": reg_number,
        "fullName": full_name.strip(),
        "organisation": organisation.strip(),
        "email": email_norm,
        "phone": phone.strip() if phone else None,
        "position": position.strip() if position else None,
        "registrationType": "online",
        "checkedInAt": None,
        "checkedInBy": None,
        "badgePrintedAt": None,
        "badgePrintCount": 0,
        "createdBy": None,
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        registrations_table().put_item(Item=item)
        audit("participant.registered", entity="participant", entity_id=item["registrationId"],
              meta={"name": item["fullName"], "email": item["email"], "phone": item["phone"],
                    "reg": item["registrationNumber"], "eventId": event_id})

        # Enqueue post-registration processing (email) via SQS
        queue_url = os.environ.get("REGISTRATION_QUEUE_URL")
        if queue_url:
            _sqs_client().send_message(QueueUrl=queue_url, MessageBody=json.dumps({
                "registrationId": item["registrationId"],
                "email": item["email"],
                "fullName": item["fullName"],
                "registrationNumber": item["registrationNumber"],
                "eventName": event_item.get("name"),
                "eventDate": event_item.get("date"),
                "venue": event_item.get("venue"),
            }))

        return ok({"registrationNumber": item["registrationNumber"],
                   "registrationId": item["registrationId"]})
    except Exception:
        log.exception("registerParticipant failed")
        return server_error()
