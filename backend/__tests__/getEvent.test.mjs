import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockSend = jest.fn();
jest.unstable_mockModule("../events/shared/db.mjs", () => ({
  db: { send: mockSend },
  EVENTS_TABLE: "events",
}));

const { handler } = await import("../events/getEvent.mjs");

const baseEvent = { httpMethod: "GET", pathParameters: { eventId: "evt-123" } };

describe("getEvent", () => {
  beforeEach(() => mockSend.mockReset());

  test("returns 200 with event", async () => {
    mockSend.mockResolvedValueOnce({ Item: { eventId: "evt-123", name: "Summit" } });
    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).eventId).toBe("evt-123");
  });

  test("returns 404 when not found", async () => {
    mockSend.mockResolvedValueOnce({});
    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(404);
  });

  test("returns 400 when eventId missing", async () => {
    const res = await handler({ ...baseEvent, pathParameters: null });
    expect(res.statusCode).toBe(400);
  });

  test("returns 500 on DynamoDB error", async () => {
    mockSend.mockRejectedValueOnce(new Error("DB error"));
    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(500);
  });

  test("handles OPTIONS preflight", async () => {
    const res = await handler({ httpMethod: "OPTIONS" });
    expect(res.statusCode).toBe(200);
  });
});
