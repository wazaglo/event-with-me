import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { db, EVENTS_TABLE } from "./shared/db.mjs";
import { ok, badRequest, notFound, serverError, cors } from "./shared/response.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  const { eventId } = event.pathParameters ?? {};
  if (!eventId) return badRequest("eventId is required");

  try {
    const result = await db.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { eventId } }));
    if (!result.Item) return notFound("Event not found");
    return ok(result.Item);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
