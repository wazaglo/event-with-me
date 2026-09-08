import os

import boto3
from botocore.config import Config

# Shared across all warm invocations of a function container.
_config = Config(retries={"max_attempts": 3, "mode": "standard"})
_resource = boto3.resource("dynamodb", config=_config)

EVENTS_TABLE = os.environ.get("EVENTS_TABLE")
REGISTRATIONS_TABLE = os.environ.get("REGISTRATIONS_TABLE")
AUDIT_TABLE = os.environ.get("AUDIT_TABLE")


def events_table():
    return _resource.Table(EVENTS_TABLE)


def registrations_table():
    return _resource.Table(REGISTRATIONS_TABLE)


def audit_table():
    return _resource.Table(AUDIT_TABLE)
