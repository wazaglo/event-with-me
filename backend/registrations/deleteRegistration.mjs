import { GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { db, REGISTRATIONS_TABLE } from "./shared/db.mjs";
import { ok, badRequest, notFound, forbidden, serverError, cors } from "./shared/response.mjs";
import { audit, callerFromEvent, isAdmin } from "./shared/auth.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  const caller = callerFromEvent(event);
  if (!isAdmin(caller.groups)) return forbidden();

  const { id } = event.pathParameters ?? {};
  if (!id) return badRequest("id is required");

  try {
    const existing = await db.send(new GetCommand({
      TableName: REGISTRATIONS_TABLE,
      Key: { registrationId: id },
    }));
    if (!existing.Item) return notFound("Registration not found");

    await db.send(new DeleteCommand({
      TableName: REGISTRATIONS_TABLE,
      Key: { registrationId: id },
    }));
    await audit("participant.deleted", {
      entity: "participant",
      entityId: id,
      actorId: caller.actorId,
      actorLabel: caller.actorLabel,
      meta: { name: existing.Item.fullName, email: existing.Item.email, phone: existing.Item.phone },
    });
    return ok({ deleted: true });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
