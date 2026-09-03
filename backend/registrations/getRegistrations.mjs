import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db, REGISTRATIONS_TABLE } from "./shared/db.mjs";
import { ok, badRequest, serverError, cors } from "./shared/response.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  const { email } = event.pathParameters ?? {};
  if (!email) return badRequest("email is required");

  const decoded = decodeURIComponent(email).toLowerCase().trim();

  try {
    const result = await db.send(new QueryCommand({
      TableName: REGISTRATIONS_TABLE,
      IndexName: "email-eventId-index",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": decoded },
    }));
    return ok(result.Items ?? []);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
