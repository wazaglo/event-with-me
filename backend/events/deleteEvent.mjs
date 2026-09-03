import { GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { db, EVENTS_TABLE } from "./shared/db.mjs";
import { ok, badRequest, notFound, forbidden, serverError, cors } from "./shared/response.mjs";
import { audit, callerFromEvent, isAdmin } from "./shared/auth.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  const caller = callerFromEvent(event);
  if (!isAdmin(caller.groups)) return forbidden();

  const { eventId } = event.pathParameters ?? {};
  if (!eventId) return badRequest("eventId is required");

  try {
    const existing = await db.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { eventId } }));
    if (!existing.Item) return notFound("Event not found");

    await db.send(new DeleteCommand({ TableName: EVENTS_TABLE, Key: { eventId } }));
    await audit("event.deleted", {
      entity: "event",
      entityId: eventId,
      actorId: caller.actorId,
      actorLabel: caller.actorLabel,
      meta: { name: existing.Item.name },
    });
    return ok({ deleted: true, eventId });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
