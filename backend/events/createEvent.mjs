import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { db, EVENTS_TABLE } from "./shared/db.mjs";
import { created, badRequest, serverError, forbidden, cors } from "./shared/response.mjs";
import { newId } from "./shared/ids.mjs";
import { audit, callerFromEvent, isAdmin } from "./shared/auth.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  const caller = callerFromEvent(event);
  if (!isAdmin(caller.groups)) return forbidden();

  let body;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return badRequest("Invalid JSON");
  }

  const { name, date, venue, description, registrationOpen = true } = body;
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return badRequest("name is required (min 2 chars)");
  }
  const item = {
    eventId: newId(),
    name: name.trim(),
    date: date ?? null,
    venue: venue ?? null,
    description: description ?? null,
    registrationOpen,
    primaryColor: body.primaryColor ?? "#00655b",
    accentColor: body.accentColor ?? "#ffd400",
    logoUrl: body.logoUrl ?? null,
    showQr: body.showQr ?? true,
    showRegistrationNumber: body.showRegistrationNumber ?? true,
    badgeFontSize: body.badgeFontSize ?? 16,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await db.send(new PutCommand({ TableName: EVENTS_TABLE, Item: item }));
    await audit("event.created", {
      entity: "event",
      entityId: item.eventId,
      actorId: caller.actorId,
      actorLabel: caller.actorLabel,
      meta: { name: item.name },
    });
    return created(item);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
