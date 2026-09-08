import json
import logging
import os
from datetime import datetime, timezone

import boto3

from shared.auth import audit
from shared.db import registrations_table

log = logging.getLogger()

# Fallback only; the CloudFormation stack injects SES_SOURCE_EMAIL.
SOURCE_EMAIL = os.environ.get("SES_SOURCE_EMAIL") or "noreply@azubisuccess.space"

_ses = None


def _ses_client():
    global _ses
    if _ses is None:
        _ses = boto3.client("sesv2")
    return _ses


def build_html(full_name, event_name, reg_number, date_str, venue):
    venue = venue or "To be announced"
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <tr><td style="background:#1a1a2e;padding:28px 32px">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#a78bfa">Registration Confirmed</p>
          <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff">{event_name}</h1>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 24px;font-size:15px;color:#374151">Hi <strong>{full_name}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151">Your registration is confirmed. Here are your details:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px">
            <tr><td style="padding:6px 0">
              <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Registration Number</span><br>
              <strong style="font-size:20px;font-family:monospace;color:#1a1a2e">{reg_number}</strong>
            </td></tr>
            <tr><td style="padding:6px 0;border-top:1px solid #e5e7eb">
              <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Date</span><br>
              <span style="font-size:14px;color:#374151">{date_str}</span>
            </td></tr>
            <tr><td style="padding:6px 0;border-top:1px solid #e5e7eb">
              <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Venue</span><br>
              <span style="font-size:14px;color:#374151">{venue}</span>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Show your registration number at reception to collect your badge.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;font-size:12px;color:#9ca3af">Sent by {event_name} . Powered by AWS</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def format_date(event_date):
    if not event_date:
        return "To be announced"
    try:
        d = datetime.fromisoformat(str(event_date).replace("Z", "+00:00"))
    except ValueError:
        return str(event_date)
    # %-d is glibc-only; strptime round-trip is portable across runtimes.
    return d.strftime("%A, %d %B %Y").replace(" 0", " ")


def _publish(payload):
    """Send the confirmation email via SES. Raises on any SES error so the
    SNS-triggered Lambda retry (and eventually the DLQ) kicks in."""
    email = payload["email"]
    full_name = payload["fullName"]
    reg_number = payload["registrationNumber"]
    event_name = payload["eventName"]
    date_str = format_date(payload.get("eventDate"))
    venue = payload.get("venue")

    subject = f"Registration confirmed - {event_name}"
    text_body = "\n".join([
        f"Hi {full_name},",
        "",
        f"Your registration for {event_name} is confirmed.",
        "",
        f"Registration number: {reg_number}",
        f"Date: {date_str}",
        f"Venue: {venue or 'To be announced'}",
        "",
        "Keep your registration number handy - show it at reception to collect your badge.",
        "",
        "See you there!",
    ])

    _ses_client().send_email(
        FromEmailAddress=SOURCE_EMAIL,
        Destination={"ToAddresses": [email]},
        Content={
            "Simple": {
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Html": {"Data": build_html(full_name, event_name, reg_number, date_str, venue), "Charset": "UTF-8"},
                    "Text": {"Data": text_body, "Charset": "UTF-8"},
                },
            },
        },
    )


def handler(event, context):
    """Consumes the registration JSON published by registerParticipant on the
    confirmation SNS topic. One record per message; raises so SNS retries
    deliver, with the topic DLQ as the final stop."""
    for record in event.get("Records", []):
        sns = record.get("Sns") or {}
        try:
            payload = json.loads(sns.get("Message") or record.get("body") or "{}")
        except ValueError:
            log.error("Unparseable SNS message: %s", sns.get("Message"))
            continue

        reg_id = payload.get("registrationId")
        if not reg_id or not payload.get("email"):
            log.error("Message missing registrationId/email: %s", payload)
            continue

        _publish(payload)

        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        registrations_table().update_item(
            Key={"registrationId": reg_id},
            UpdateExpression="SET emailSentAt = :t, updatedAt = :t",
            ExpressionAttributeValues={":t": now},
        )
        audit("ticket.processed", entity="registration", entity_id=reg_id,
              meta={"registrationNumber": payload.get("registrationNumber"),
                    "eventName": payload.get("eventName"),
                    "email": payload.get("email")})
        log.info("Confirmation sent for %s (%s)", payload.get("registrationNumber"),
                 payload.get("email"))
