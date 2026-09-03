import { PutCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db, REGISTRATIONS_TABLE, EVENTS_TABLE } from "./shared/db.mjs";
import { ok, badRequest, conflict, serverError, cors } from "./shared/response.mjs";
import { newId, registrationNumber } from "./shared/ids.mjs";
import { audit, callerFromEvent } from "./shared/auth.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  const caller = callerFromEvent(event);
  const { eventId } = event.pathParameters ?? {};
  if (!eventId) return badRequest("eventId is required");

  let body;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return badRequest("Invalid JSON");
  }

  const { fullName, organisation, email, phone, position } = body;
  if (!fullName || fullName.trim().length < 2) return badRequest("fullName is required");
  if (!organisation || organisation.trim().length < 2) return badRequest("organisation is required");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return badRequest("Valid email is required");

  const eventResult = await db.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { eventId } }));
  if (!eventResult.Item) return badRequest("Event not found");

  // Duplicate check
  const existing = await db.send(new QueryCommand({
    TableName: REGISTRATIONS_TABLE,
    IndexName: "email-eventId-index",
    KeyConditionExpression: "email = :email AND eventId = :eventId",
    ExpressionAttributeValues: { ":email": email.toLowerCase().trim(), ":eventId": eventId },
    Limit: 1,
  }));
  if ((existing.Items ?? []).length > 0) return conflict("This email is already registered for this event");

  const item = {
    registrationId: newId(),
    eventId,
    registrationNumber: registrationNumber(
      eventResult.Item.name.replace(/\s+/g, "").slice(0, 6).toUpperCase()
    ),
    fullName: fullName.trim(),
    organisation: organisation.trim(),
    email: email.toLowerCase().trim(),
    phone: phone?.trim() ?? null,
    position: position?.trim() ?? null,
    registrationType: "walk_in",
    checkedInAt: null,
    checkedInBy: null,
    badgePrintedAt: null,
    badgePrintCount: 0,
    createdBy: caller.actorId ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await db.send(new PutCommand({ TableName: REGISTRATIONS_TABLE, Item: item }));
    await audit("participant.walk_in_registered", {
      entity: "participant",
      entityId: item.registrationId,
      actorId: caller.actorId,
      actorLabel: caller.actorLabel,
      meta: { name: item.fullName, email: item.email, phone: item.phone, reg: item.registrationNumber },
    });
    return ok(item);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
