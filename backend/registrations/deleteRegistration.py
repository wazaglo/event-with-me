import logging

from shared.auth import audit, caller_from_event, is_admin
from shared.db import registrations_table
from shared.response import bad_request, cors, forbidden, not_found, ok, server_error, with_cors

log = logging.getLogger()


@with_cors
def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return cors()

    caller = caller_from_event(event)
    if not is_admin(caller["groups"]):
        return forbidden()

    reg_id = (event.get("pathParameters") or {}).get("id")
    if not reg_id:
        return bad_request("id is required")

    try:
        existing = registrations_table().get_item(Key={"registrationId": reg_id}).get("Item")
        if not existing:
            return not_found("Registration not found")

        registrations_table().delete_item(Key={"registrationId": reg_id})
        audit("participant.deleted", entity="participant", entity_id=reg_id,
              actor_id=caller["actorId"], actor_label=caller["actorLabel"],
              meta={"name": existing.get("fullName"), "email": existing.get("email"),
                    "phone": existing.get("phone")})
        return ok({"deleted": True})
    except Exception:
        log.exception("deleteRegistration failed")
        return server_error()
