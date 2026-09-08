import json
import os
from decimal import Decimal

ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN") or "*"

CORS = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


def _default(o):
    # boto3 returns DynamoDB numbers as Decimal; emit them as JSON numbers.
    if isinstance(o, Decimal):
        return int(o) if o == o.to_integral_value() else float(o)
    raise TypeError(f"not JSON serializable: {type(o)}")


def _json(body):
    return json.dumps(body, default=_default)


def ok(body):
    return {"statusCode": 200, "headers": CORS, "body": _json(body)}


def created(body):
    return {"statusCode": 201, "headers": CORS, "body": _json(body)}


def bad_request(message):
    return {"statusCode": 400, "headers": CORS, "body": _json({"error": message})}


def forbidden(message="Forbidden"):
    return {"statusCode": 403, "headers": CORS, "body": _json({"error": message})}


def not_found(message="Not Found"):
    return {"statusCode": 404, "headers": CORS, "body": _json({"error": message})}


def conflict(message):
    return {"statusCode": 409, "headers": CORS, "body": _json({"error": message})}


def server_error(message="Internal Server Error"):
    return {"statusCode": 500, "headers": CORS, "body": _json({"error": message})}


def cors():
    return {"statusCode": 200, "headers": CORS, "body": ""}
