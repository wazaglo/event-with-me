import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, REGISTRATIONS_TABLE } from "./shared/db.mjs";
import { audit } from "./shared/auth.mjs";

const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";

async function sendSendGrid(email, subject, textBody, htmlBody) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return;

  const res = await fetch(SENDGRID_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: "noreply@azubisuccess.space", name: "Event Registration" },
      subject,
      content: [
        { type: "text/plain", value: textBody },
        { type: "text/html", value: htmlBody },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("SendGrid error", res.status, err);
    throw new Error(`SendGrid email failed: ${res.status}`);
  }
}

function buildHtml(fullName, eventName, registrationNumber, dateStr, venue) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <tr><td style="background:#1a1a2e;padding:28px 32px">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#a78bfa">Registration Confirmed</p>
          <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff">${eventName}</h1>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 24px;font-size:15px;color:#374151">Hi <strong>${fullName}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151">Your registration is confirmed. Here are your details:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px">
            <tr><td style="padding:6px 0">
              <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Registration Number</span><br>
              <strong style="font-size:20px;font-family:monospace;color:#1a1a2e">${registrationNumber}</strong>
            </td></tr>
            <tr><td style="padding:6px 0;border-top:1px solid #e5e7eb">
              <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Date</span><br>
              <span style="font-size:14px;color:#374151">${dateStr}</span>
            </td></tr>
            <tr><td style="padding:6px 0;border-top:1px solid #e5e7eb">
              <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Venue</span><br>
              <span style="font-size:14px;color:#374151">${venue ?? "To be announced"}</span>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Show your registration number at reception to collect your badge.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;font-size:12px;color:#9ca3af">Sent by ${eventName} · Powered by AWS</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function handler(event) {
  const failures = [];

  for (const record of event.Records) {
    let payload;
    try {
      payload = JSON.parse(record.body);
    } catch (e) {
      console.error("Failed to parse SQS message", record.body, e);
      failures.push({ itemIdentifier: record.messageId });
      continue;
    }

    const { registrationId, email, fullName, registrationNumber, eventName, eventDate, venue } = payload;

    const dateStr = eventDate
      ? new Date(eventDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : "To be announced";

    const subject = `Registration confirmed - ${eventName}`;
    const textBody = [
      `Hi ${fullName},`,
      ``,
      `Your registration for ${eventName} is confirmed.`,
      ``,
      `Registration number: ${registrationNumber}`,
      `Date: ${dateStr}`,
      `Venue: ${venue ?? "To be announced"}`,
      ``,
      `Keep your registration number handy - show it at reception to collect your badge.`,
      ``,
      `See you there!`,
    ].join("\n");

    const now = new Date().toISOString();

    try {
      await sendSendGrid(email, subject, textBody, buildHtml(fullName, eventName, registrationNumber, dateStr, venue));

      await db.send(new UpdateCommand({
        TableName: REGISTRATIONS_TABLE,
        Key: { registrationId },
        UpdateExpression: "SET emailSentAt = :t, updatedAt = :t",
        ExpressionAttributeValues: { ":t": now },
      }));

      await audit("ticket.processed", {
        entity: "registration",
        entityId: registrationId,
        meta: { registrationNumber, eventName, email },
      });

      console.log(`Processed registration ${registrationNumber} for ${fullName} (${email})`);
    } catch (e) {
      console.error("Failed to process record", registrationId, e);
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures: failures };
}
