import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockSend = jest.fn();
jest.unstable_mockModule("../events/shared/db.mjs", () => ({
  db: { send: mockSend },
  EVENTS_TABLE: "events",
  AUDIT_TABLE: "audit",
}));
jest.unstable_mockModule("../events/shared/ids.mjs", () => ({
  newId: () => "gen-id-123",
}));

const { handler } = await import("../events/createEvent.mjs");

const adminEvent = (body) => ({
  httpMethod: "POST",
  pathParameters: null,
  requestContext: { authorizer: { claims: { sub: "u1", name: "Admin", "cognito:groups": "Admin" } } },
  body: JSON.stringify(body),
});

describe("createEvent", () => {
  beforeEach(() => mockSend.mockReset());

  test("creates event with valid data", async () => {
    mockSend.mockResolvedValueOnce({});
    mockSend.mockResolvedValueOnce({});
    const res = await handler(adminEvent({ name: "Summit 2026" }));
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.name).toBe("Summit 2026");
    expect(body.eventId).toBe("gen-id-123");
  });

  test("returns 403 for non-admin", async () => {
    const event = adminEvent({ name: "Test" });
    event.requestContext.authorizer.claims["cognito:groups"] = "";
    const res = await handler(event);
    expect(res.statusCode).toBe(403);
  });

  test("returns 400 when name missing", async () => {
    const res = await handler(adminEvent({}));
    expect(res.statusCode).toBe(400);
  });

  test("returns 500 on DynamoDB error", async () => {
    mockSend.mockRejectedValueOnce(new Error("DB error"));
    const res = await handler(adminEvent({ name: "Test" }));
    expect(res.statusCode).toBe(500);
  });
});
