import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

BACKEND = Path(__file__).resolve().parents[1]

# boto3 resolves region/credentials at resource construction time (module
# import), so these must exist before any handler module is imported.
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("EVENTS_TABLE", "events-test")
os.environ.setdefault("REGISTRATIONS_TABLE", "registrations-test")
os.environ.setdefault("AUDIT_TABLE", "audit-test")
os.environ.setdefault("SES_SOURCE_EMAIL", "noreply@example.com")

# Handler modules import `shared.*` (backend/) and sit at the zip root
# (backend/events, backend/registrations) — mirror the lambda layout.
for p in (BACKEND / "events", BACKEND / "registrations", BACKEND / "notifications", BACKEND):
    sp = str(p)
    if sp not in sys.path:
        sys.path.insert(0, sp)


def fake_table(**returns):
    """MagicMock DynamoDB table; each kwarg is a method name → return value."""
    table = MagicMock()
    for method, value in returns.items():
        getattr(table, method).return_value = value
    return table
