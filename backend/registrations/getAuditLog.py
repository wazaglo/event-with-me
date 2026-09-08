import logging

from shared.auth import caller_from_event, is_admin
from shared.db import audit_table
from shared.response import cors, forbidden, ok, server_error, with_cors

log = logging.getLogger()


@with_cors
def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return cors()

    caller = caller_from_event(event)
    if not is_admin(caller["groups"]):
        return forbidden()

    try:
        qp = event.get("queryStringParameters") or {}

        filter_parts = []
        expr_names = {}
        expr_values = {}

        if qp.get("entity"):
            filter_parts.append("#entity = :entity")
            expr_names["#entity"] = "entity"
            expr_values[":entity"] = qp["entity"]
        if qp.get("entityId"):
            filter_parts.append("#entityId = :entityId")
            expr_names["#entityId"] = "entityId"
            expr_values[":entityId"] = qp["entityId"]
        if qp.get("actorId"):
            filter_parts.append("#actorId = :actorId")
            expr_names["#actorId"] = "actorId"
            expr_values[":actorId"] = qp["actorId"]

        params = {}
        if filter_parts:
            params["FilterExpression"] = " AND ".join(filter_parts)
            params["ExpressionAttributeNames"] = expr_names
            params["ExpressionAttributeValues"] = expr_values

        result = audit_table().scan(**params)
        items = sorted(result.get("Items", []),
                       key=lambda a: a.get("createdAt") or "", reverse=True)
        return ok(items)
    except Exception:
        log.exception("getAuditLog failed")
        return server_error()
