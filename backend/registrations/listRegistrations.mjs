import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db, REGISTRATIONS_TABLE } from "./shared/db.mjs";
import { ok, badRequest, serverError, cors } from "./shared/response.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  const { eventId } = event.pathParameters ?? {};
  if (!eventId) return badRequest("eventId is required");

  const qp = event.queryStringParameters ?? {};
  const search = qp.search?.trim().toLowerCase() ?? "";
  const type = qp.type ?? "all";
  const status = qp.status ?? "all";

  try {
    // Query by eventId using GSI
    const result = await db.send(new QueryCommand({
      TableName: REGISTRATIONS_TABLE,
      IndexName: "eventId-createdAt-index",
      KeyConditionExpression: "eventId = :eid",
      ExpressionAttributeValues: { ":eid": eventId },
      ScanIndexForward: false,
      Limit: 500,
    }));

    let items = result.Items ?? [];

    if (search) {
      items = items.filter((r) =>
        r.fullName?.toLowerCase().includes(search) ||
        r.email?.toLowerCase().includes(search) ||
        r.organisation?.toLowerCase().includes(search) ||
        r.registrationNumber?.toLowerCase().includes(search)
      );
    }
    if (type !== "all") items = items.filter((r) => r.registrationType === type);
    if (status === "checked") items = items.filter((r) => r.checkedInAt);
    if (status === "pending") items = items.filter((r) => !r.checkedInAt);

    return ok(items);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
