import logging

from shared.db import registrations_table
from shared.response import bad_request, cors, ok, server_error

log = logging.getLogger()


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return cors()

    event_id = (event.get("pathParameters") or {}).get("eventId")
    if not event_id:
        return bad_request("eventId is required")

    qp = event.get("queryStringParameters") or {}
    search = (qp.get("search") or "").strip().lower()
    type_filter = qp.get("type") or "all"
    status = qp.get("status") or "all"

    try:
        result = registrations_table().query(
            IndexName="eventId-createdAt-index",
            KeyConditionExpression="eventId = :eid",
            ExpressionAttributeValues={":eid": event_id},
            ScanIndexForward=False,
            Limit=500,
        )
        items = result.get("Items", [])

        if search:
            def matches(r):
                for field in ("fullName", "email", "organisation", "registrationNumber"):
                    val = r.get(field)
                    if val and search in val.lower():
                        return True
                return False
            items = [r for r in items if matches(r)]
        if type_filter != "all":
            items = [r for r in items if r.get("registrationType") == type_filter]
        if status == "checked":
            items = [r for r in items if r.get("checkedInAt")]
        if status == "pending":
            items = [r for r in items if not r.get("checkedInAt")]

        return ok(items)
    except Exception:
        log.exception("listRegistrations failed")
        return server_error()
