import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
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

    const now = new Date().toISOString();
    const newCount = (existing.Item.badgePrintCount ?? 0) + 1;

    await db.send(new UpdateCommand({
      TableName: REGISTRATIONS_TABLE,
      Key: { registrationId: id },
      UpdateExpression: "SET badgePrintedAt = :t, badgePrintCount = :c, updatedAt = :t",
      ExpressionAttributeValues: { ":t": now, ":c": newCount },
    }));
    await audit("badge.printed", {
      entity: "participant", entityId: id,
      actorId: caller.actorId, actorLabel: caller.actorLabel,
    });
    return ok({ badgePrintedAt: now, badgePrintCount: newCount });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
