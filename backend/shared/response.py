import functools
import json
import os
from decimal import Decimal

# Comma-separated list of origins allowed to call the API. "*" (default) echoes
# any origin; set it to the deployed frontend's origin to lock the API down.
# Local dev origins are always allowed so `bun run dev` works against prod.
_ALLOWED = [o.strip() for o in os.environ.get("ALLOWED_ORIGIN", "").split(",") if o.strip()]
_DEV_ORIGINS = {"http://localhost:5173", "http://127.0.0.1:5173"}

_request_origin = None


def _origin_allowed(origin):
    if not origin:
        return False
    if origin in _DEV_ORIGINS:
        return True
    return not _ALLOWED or "*" in _ALLOWED or origin in _ALLOWED


def _cors_headers():
    headers = {
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    }
    if _request_origin is None:
        # Called outside a request (unit tests): keep the permissive default.
        allow = "*" if not _ALLOWED or "*" in _ALLOWED else _ALLOWED[0]
    else:
        allow = _request_origin if _origin_allowed(_request_origin) else None
    if allow:
        headers["Access-Control-Allow-Origin"] = allow
        headers["Vary"] = "Origin"
    return headers


def with_cors(fn):
    """Handler decorator: capture the request Origin so response helpers
    can echo it back when it is on the allow list."""

    @functools.wraps(fn)
    def wrapper(event, context):
        global _request_origin
        headers = (event or {}).get("headers") or {}
        origin = ""
        for key, value in headers.items():
            if key.lower() == "origin":
                origin = value
                break
        _request_origin = origin
        try:
            return fn(event, context)
        finally:
            _request_origin = None

    return wrapper


def _default(o):
    # boto3 returns DynamoDB numbers as Decimal; emit them as JSON numbers.
    if isinstance(o, Decimal):
        return int(o) if o == o.to_integral_value() else float(o)
    raise TypeError(f"not JSON serializable: {type(o)}")


def _json(body):
    return json.dumps(body, default=_default)


def ok(body):
    return {"statusCode": 200, "headers": _cors_headers(), "body": _json(body)}


def created(body):
    return {"statusCode": 201, "headers": _cors_headers(), "body": _json(body)}


def bad_request(message):
    return {"statusCode": 400, "headers": _cors_headers(), "body": _json({"error": message})}


def forbidden(message="Forbidden"):
    return {"statusCode": 403, "headers": _cors_headers(), "body": _json({"error": message})}


def not_found(message="Not Found"):
    return {"statusCode": 404, "headers": _cors_headers(), "body": _json({"error": message})}


def conflict(message):
    return {"statusCode": 409, "headers": _cors_headers(), "body": _json({"error": message})}


def server_error(message="Internal Server Error"):
    return {"statusCode": 500, "headers": _cors_headers(), "body": _json({"error": message})}


def cors():
    return {"statusCode": 200, "headers": _cors_headers(), "body": ""}
