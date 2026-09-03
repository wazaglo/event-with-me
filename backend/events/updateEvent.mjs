import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, EVENTS_TABLE } from "./shared/db.mjs";
import { ok, badRequest, notFound, forbidden, serverError, cors } from "./shared/response.mjs";
import { audit, callerFromEvent, isAdmin } from "./shared/auth.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  const caller = callerFromEvent(event);
  if (!isAdmin(caller.groups)) return forbidden();

  const { eventId } = event.pathParameters ?? {};
  if (!eventId) return badRequest("eventId is required");

  let body;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return badRequest("Invalid JSON");
  }

  // Verify event exists
  const existing = await db.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { eventId } }));
  if (!existing.Item) return notFound("Event not found");

  const updates = {};
  const allowed = ["name", "date", "venue", "description", "registrationOpen", "primaryColor",
    "accentColor", "logoUrl", "showQr", "showRegistrationNumber", "badgeFontSize"];
  allowed.forEach((k) => { if (k in body) updates[k] = body[k]; });
  updates.updatedAt = new Date().toISOString();

  const setExpr = Object.keys(updates).map((k) => `#${k} = :${k}`).join(", ");
  const exprNames = Object.fromEntries(Object.keys(updates).map((k) => [`#${k}`, k]));
  const exprValues = Object.fromEntries(Object.keys(updates).map((k) => [`:${k}`, updates[k]]));

  try {
    await db.send(new UpdateCommand({
      TableName: EVENTS_TABLE,
      Key: { eventId },
      UpdateExpression: `SET ${setExpr}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
    }));
    await audit("event.updated", {
      entity: "event", entityId: eventId,
      actorId: caller.actorId, actorLabel: caller.actorLabel,
    });
    return ok({ eventId, ...updates });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
