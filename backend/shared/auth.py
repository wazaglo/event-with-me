from datetime import datetime, timezone

from .db import AUDIT_TABLE, audit_table
from .ids import new_id


def audit(action, entity=None, entity_id=None, actor_id=None, actor_label=None, meta=None):
    if not AUDIT_TABLE:
        return
    audit_table().put_item(Item={
        "auditId": new_id(),
        "action": action,
        "entity": entity,
        "entityId": entity_id,
        "actorId": actor_id,
        "actorLabel": actor_label,
        "meta": meta or {},
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    })


# Extract caller identity from Cognito authorizer context
def caller_from_event(event):
    claims = (event.get("requestContext") or {}).get("authorizer", {}).get("claims") or {}
    groups = [g for g in (claims.get("cognito:groups") or "").split(",") if g]
    return {
        "actorId": claims.get("sub"),
        "actorLabel": claims.get("name") or claims.get("email"),
        "groups": groups,
    }


def is_admin(groups=None):
    return "Admin" in (groups or [])


def iso_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
