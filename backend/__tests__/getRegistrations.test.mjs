import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockSend = jest.fn();
jest.unstable_mockModule("../registrations/shared/db.mjs", () => ({
  db: { send: mockSend },
  REGISTRATIONS_TABLE: "registrations",
}));

const { handler } = await import("../registrations/getRegistrations.mjs");

const baseEvent = (email) => ({
  httpMethod: "GET",
  pathParameters: { email: encodeURIComponent(email) },
});

describe("getRegistrations", () => {
  beforeEach(() => mockSend.mockReset());

  test("returns registrations for email", async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ registrationId: "r1", email: "alice@test.com" }] });
    const res = await handler(baseEvent("alice@test.com"));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(1);
  });

  test("returns empty array when none found", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const res = await handler(baseEvent("nobody@test.com"));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  test("returns 400 when email missing", async () => {
    const res = await handler({ ...baseEvent("x"), pathParameters: null });
    expect(res.statusCode).toBe(400);
  });
});
