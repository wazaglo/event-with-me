import { handler } from "../events/listEvents.mjs";

const mockSend = jest.fn();
jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  ScanCommand: jest.fn((input) => ({ input })),
}));
jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

const baseEvent = { httpMethod: "GET", pathParameters: null, requestContext: { authorizer: { claims: {} } } };

describe("listEvents", () => {
  beforeEach(() => mockSend.mockReset());

  test("returns 200 with sorted events", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        { eventId: "1", name: "Summit A", createdAt: "2026-01-01T00:00:00Z" },
        { eventId: "2", name: "Summit B", createdAt: "2026-06-01T00:00:00Z" },
      ],
    });
    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(2);
    // Most recent first
    expect(body[0].eventId).toBe("2");
  });

  test("returns empty array when no events", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  test("returns 500 on DynamoDB error", async () => {
    mockSend.mockRejectedValueOnce(new Error("DynamoDB unavailable"));
    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(500);
  });

  test("handles OPTIONS preflight", async () => {
    const res = await handler({ httpMethod: "OPTIONS" });
    expect(res.statusCode).toBe(200);
  });
});
