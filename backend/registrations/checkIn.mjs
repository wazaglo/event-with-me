import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, REGISTRATIONS_TABLE } from "./shared/db.mjs";
import { ok, badRequest, notFound, serverError, cors } from "./shared/response.mjs";
import { audit, callerFromEvent } from "./shared/auth.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  const caller = callerFromEvent(event);
  const { id } = event.pathParameters ?? {};
  if (!id) return badRequest("id is required");

  try {
    const existing = await db.send(new GetCommand({
      TableName: REGISTRATIONS_TABLE,
      Key: { registrationId: id },
    }));
    if (!existing.Item) return notFound("Registration not found");
    if (existing.Item.checkedInAt) return ok({ ...existing.Item, alreadyCheckedIn: true });

    const now = new Date().toISOString();
    await db.send(new UpdateCommand({
      TableName: REGISTRATIONS_TABLE,
      Key: { registrationId: id },
      UpdateExpression: "SET checkedInAt = :t, checkedInBy = :by, updatedAt = :t",
      ExpressionAttributeValues: {
        ":t": now,
        ":by": caller.actorId ?? "system",
      },
    }));
    await audit("participant.checked_in", {
      entity: "participant",
      entityId: id,
      actorId: caller.actorId,
      actorLabel: caller.actorLabel,
      meta: { name: existing.Item.fullName, email: existing.Item.email, phone: existing.Item.phone },
    });
    return ok({ ...existing.Item, checkedInAt: now, checkedInBy: caller.actorId });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
