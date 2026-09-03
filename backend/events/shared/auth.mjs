import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { db, AUDIT_TABLE } from "./db.mjs";
import { newId } from "./ids.mjs";

export async function audit(action, opts = {}) {
  if (!AUDIT_TABLE) return;
  await db.send(
    new PutCommand({
      TableName: AUDIT_TABLE,
      Item: {
        auditId: newId(),
        action,
        entity: opts.entity ?? null,
        entityId: opts.entityId ?? null,
        actorId: opts.actorId ?? null,
        actorLabel: opts.actorLabel ?? null,
        meta: opts.meta ?? {},
        createdAt: new Date().toISOString(),
      },
    })
  );
}

// Extract caller identity from Cognito authorizer context
export function callerFromEvent(event) {
  const claims = event.requestContext?.authorizer?.claims ?? {};

  return {
    actorId: claims.sub ?? null,
    actorLabel: claims.name ?? claims.email ?? null,
    groups: (claims["cognito:groups"] ?? "")
      .split(",")
      .filter(Boolean),
  };
}

export function isAdmin(groups = []) {
  return groups.includes("Admin");
}
