import logging

from shared.db import events_table
from shared.response import cors, ok, server_error, with_cors

log = logging.getLogger()


@with_cors
def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return cors()

    try:
        result = events_table().scan()
        events = sorted(result.get("Items", []),
                        key=lambda e: e.get("createdAt") or "", reverse=True)
        return ok(events)
    except Exception:
        log.exception("listEvents failed")
        return server_error()
