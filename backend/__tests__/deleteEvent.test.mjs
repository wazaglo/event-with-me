import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockSend = jest.fn();
jest.unstable_mockModule("../events/shared/db.mjs", () => ({
  db: { send: mockSend },
  EVENTS_TABLE: "events",
  AUDIT_TABLE: "audit",
}));

const { handler } = await import("../events/deleteEvent.mjs");

const adminEvent = (eventId) => ({
  httpMethod: "DELETE",
  pathParameters: { eventId },
  requestContext: { authorizer: { claims: { sub: "u1", name: "Admin", "cognito:groups": "Admin" } } },
});

describe("deleteEvent", () => {
  beforeEach(() => mockSend.mockReset());

  test("deletes existing event", async () => {
    mockSend.mockResolvedValueOnce({ Item: { eventId: "evt-1", name: "Old" } });
    mockSend.mockResolvedValueOnce({});
    mockSend.mockResolvedValueOnce({});
    const res = await handler(adminEvent("evt-1"));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).deleted).toBe(true);
  });

  test("returns 404 when event not found", async () => {
    mockSend.mockResolvedValueOnce({});
    const res = await handler(adminEvent("evt-missing"));
    expect(res.statusCode).toBe(404);
  });

  test("returns 403 for non-admin", async () => {
    const event = adminEvent("evt-1");
    event.requestContext.authorizer.claims["cognito:groups"] = "";
    const res = await handler(event);
    expect(res.statusCode).toBe(403);
  });
});
