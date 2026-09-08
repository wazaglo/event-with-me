import logging

from shared.db import events_table
from shared.response import bad_request, cors, not_found, ok, server_error, with_cors

log = logging.getLogger()


@with_cors
def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return cors()

    event_id = (event.get("pathParameters") or {}).get("eventId")
    if not event_id:
        return bad_request("eventId is required")

    try:
        result = events_table().get_item(Key={"eventId": event_id})
        item = result.get("Item")
        if not item:
            return not_found("Event not found")
        return ok(item)
    except Exception:
        log.exception("getEvent failed")
        return server_error()
