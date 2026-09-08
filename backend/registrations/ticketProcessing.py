import json
import logging
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone

from shared.auth import audit
from shared.db import registrations_table

log = logging.getLogger()

SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send"


def _send_sendgrid(email, subject, text_body, html_body):
    api_key = os.environ.get("SENDGRID_API_KEY")
    if not api_key:
        return

    payload = json.dumps({
        "personalizations": [{"to": [{"email": email}]}],
        "from": {"email": "noreply@azubisuccess.space", "name": "Event Registration"},
        "subject": subject,
        "content": [
            {"type": "text/plain", "value": text_body},
            {"type": "text/html", "value": html_body},
        ],
    }).encode()

    req = urllib.request.Request(SENDGRID_URL, data=payload, method="POST", headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    })
    try:
        urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        log.error("SendGrid error %s %s", e.code, body)
        raise RuntimeError(f"SendGrid email failed: {e.code}")


def _build_html(full_name, event_name, reg_number, date_str, venue):
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
          <p style="margin:0;font-size:12px;color:#9ca3af">Sent by {event_name} · Powered by AWS</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _format_date(event_date):
    if not event_date:
        return "To be announced"
    try:
        d = datetime.fromisoformat(str(event_date).replace("Z", "+00:00"))
    except ValueError:
        return str(event_date)
    return d.strftime("%A, %-d %B %Y")


def handler(event, context):
    failures = []

    for record in event.get("Records", []):
        try:
            payload = json.loads(record["body"])
        except (ValueError, KeyError):
            log.error("Failed to parse SQS message %s", record.get("body"))
            failures.append({"itemIdentifier": record.get("messageId")})
            continue

        reg_id = payload.get("registrationId")
        email = payload.get("email")
        full_name = payload.get("fullName")
        reg_number = payload.get("registrationNumber")
        event_name = payload.get("eventName")
        date_str = _format_date(payload.get("eventDate"))
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

        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        try:
            _send_sendgrid(email, subject, text_body,
                           _build_html(full_name, event_name, reg_number, date_str, venue))

            registrations_table().update_item(
                Key={"registrationId": reg_id},
                UpdateExpression="SET emailSentAt = :t, updatedAt = :t",
                ExpressionAttributeValues={":t": now},
            )
            audit("ticket.processed", entity="registration", entity_id=reg_id,
                  meta={"registrationNumber": reg_number, "eventName": event_name, "email": email})
            log.info("Processed registration %s for %s (%s)", reg_number, full_name, email)
        except Exception as e:
            log.error("Failed to process record %s: %s", reg_id, e)
            failures.append({"itemIdentifier": record.get("messageId")})

    return {"batchItemFailures": failures}
