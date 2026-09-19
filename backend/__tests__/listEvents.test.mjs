import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockSend = jest.fn();
jest.unstable_mockModule("../events/shared/db.mjs", () => ({
  db: { send: mockSend },
  EVENTS_TABLE: "events",
}));

const { handler } = await import("../events/listEvents.mjs");

const baseEvent = { httpMethod: "GET", pathParameters: null };

describe("listEvents", () => {
  beforeEach(() => mockSend.mockReset());

  test("returns 200 with sorted events", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        { eventId: "1", name: "A", createdAt: "2026-01-01T00:00:00Z" },
        { eventId: "2", name: "B", createdAt: "2026-06-01T00:00:00Z" },
      ],
    });
    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(2);
    expect(body[0].eventId).toBe("2");
  });

  test("returns empty array when no events", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
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
