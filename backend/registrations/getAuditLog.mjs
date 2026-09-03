import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { db, AUDIT_TABLE } from "./shared/db.mjs";
import { ok, forbidden, serverError, cors } from "./shared/response.mjs";
import { callerFromEvent, isAdmin } from "./shared/auth.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  const caller = callerFromEvent(event);
  if (!isAdmin(caller.groups)) return forbidden();

  try {
    const { entity, entityId, actorId } = event.queryStringParameters ?? {};

    const filterParts = [];
    const exprNames = {};
    const exprValues = {};

    if (entity) {
      filterParts.push("#entity = :entity");
      exprNames["#entity"] = "entity";
      exprValues[":entity"] = entity;
    }
    if (entityId) {
      filterParts.push("#entityId = :entityId");
      exprNames["#entityId"] = "entityId";
      exprValues[":entityId"] = entityId;
    }
    if (actorId) {
      filterParts.push("#actorId = :actorId");
      exprNames["#actorId"] = "actorId";
      exprValues[":actorId"] = actorId;
    }

    const params = { TableName: AUDIT_TABLE };
    if (filterParts.length > 0) {
      params.FilterExpression = filterParts.join(" AND ");
      params.ExpressionAttributeNames = exprNames;
      params.ExpressionAttributeValues = exprValues;
    }

    const result = await db.send(new ScanCommand(params));
    const items = (result.Items ?? []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    return ok(items);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
