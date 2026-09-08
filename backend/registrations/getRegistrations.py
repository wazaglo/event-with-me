import logging
from urllib.parse import unquote

from shared.db import registrations_table
from shared.response import bad_request, cors, ok, server_error

log = logging.getLogger()


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return cors()

    email = (event.get("pathParameters") or {}).get("email")
    if not email:
        return bad_request("email is required")

    decoded = unquote(email).strip().lower()

    try:
        result = registrations_table().query(
            IndexName="email-eventId-index",
            KeyConditionExpression="email = :email",
            ExpressionAttributeValues={":email": decoded},
        )
        return ok(result.get("Items", []))
    except Exception:
        log.exception("getRegistrations failed")
        return server_error()
