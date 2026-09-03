import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, REGISTRATIONS_TABLE } from "./shared/db.mjs";
import { ok, badRequest, notFound, serverError, cors } from "./shared/response.mjs";
import { audit, callerFromEvent } from "./shared/auth.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  const caller = callerFromEvent(event);
  const { id } = event.pathParameters ?? {};
  if (!id) return badRequest("id is required");

  let body;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return badRequest("Invalid JSON");
  }

  try {
    const existing = await db.send(new GetCommand({
      TableName: REGISTRATIONS_TABLE,
      Key: { registrationId: id },
    }));
    if (!existing.Item) return notFound("Registration not found");

    const allowed = ["fullName", "organisation", "email", "phone", "position"];
    const updates = { updatedAt: new Date().toISOString() };
    allowed.forEach((k) => { if (k in body) updates[k] = body[k]; });

    const setExpr = Object.keys(updates).map((k) => `#${k} = :${k}`).join(", ");
    const exprNames = Object.fromEntries(Object.keys(updates).map((k) => [`#${k}`, k]));
    const exprValues = Object.fromEntries(Object.keys(updates).map((k) => [`:${k}`, updates[k]]));

    await db.send(new UpdateCommand({
      TableName: REGISTRATIONS_TABLE,
      Key: { registrationId: id },
      UpdateExpression: `SET ${setExpr}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
      ReturnValues: "ALL_NEW",
    }));
    await audit("participant.edited", {
      entity: "participant", entityId: id,
      actorId: caller.actorId, actorLabel: caller.actorLabel,
    });
    return ok({ registrationId: id, ...updates });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
