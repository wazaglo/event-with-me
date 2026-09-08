import logging

from shared.db import registrations_table
from shared.response import bad_request, cors, not_found, ok, server_error

log = logging.getLogger()


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return cors()

    reg_id = (event.get("pathParameters") or {}).get("id")
    if not reg_id:
        return bad_request("id is required")

    try:
        item = registrations_table().get_item(Key={"registrationId": reg_id}).get("Item")
        if not item:
            return not_found("Registration not found")
        return ok(item)
    except Exception:
        log.exception("getRegistration failed")
        return server_error()
