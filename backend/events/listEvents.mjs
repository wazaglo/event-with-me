import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { db, EVENTS_TABLE } from "./shared/db.mjs";
import { ok, serverError, cors } from "./shared/response.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  try {
    const result = await db.send(new ScanCommand({ TableName: EVENTS_TABLE }));
    const events = (result.Items ?? []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    return ok(events);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
