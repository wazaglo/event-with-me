import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockSend = jest.fn();
jest.unstable_mockModule("../registrations/shared/db.mjs", () => ({
  db: { send: mockSend },
  REGISTRATIONS_TABLE: "registrations",
  AUDIT_TABLE: "audit",
}));

const { handler } = await import("../registrations/checkIn.mjs");

const authEvent = (id) => ({
  httpMethod: "POST",
  pathParameters: { id },
  requestContext: { authorizer: { claims: { sub: "user-1", name: "Staff" } } },
});

describe("checkIn", () => {
  beforeEach(() => mockSend.mockReset());

  test("checks in a pending registration", async () => {
    mockSend
      .mockResolvedValueOnce({ Item: { registrationId: "reg-1", fullName: "Alice", email: "a@b.com" } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const res = await handler(authEvent("reg-1"));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).checkedInAt).toBeDefined();
  });

  test("returns alreadyCheckedIn if already checked in", async () => {
    mockSend.mockResolvedValueOnce({ Item: { registrationId: "reg-1", checkedInAt: "2026-01-01T00:00:00Z" } });
    const res = await handler(authEvent("reg-1"));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).alreadyCheckedIn).toBe(true);
  });

  test("returns 404 when not found", async () => {
    mockSend.mockResolvedValueOnce({});
    const res = await handler(authEvent("reg-missing"));
    expect(res.statusCode).toBe(404);
  });

  test("returns 400 when id missing", async () => {
    const res = await handler({ ...authEvent("x"), pathParameters: null });
    expect(res.statusCode).toBe(400);
  });
});
