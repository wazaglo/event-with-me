import { handler } from "../registrations/registerParticipant.mjs";

// Mock AWS SDK
const mockSend = jest.fn();
jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  PutCommand: jest.fn((input) => ({ input })),
  QueryCommand: jest.fn((input) => ({ input })),
  GetCommand: jest.fn((input) => ({ input })),
}));
jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));
jest.mock("@aws-sdk/client-sns", () => ({
  SNSClient: jest.fn(() => ({ send: jest.fn() })),
  PublishCommand: jest.fn(),
}));

const baseEvent = {
  httpMethod: "POST",
  pathParameters: { eventId: "evt-123" },
  requestContext: { authorizer: { claims: {} } },
  body: JSON.stringify({
    fullName: "Ama Owusu",
    organisation: "National Bank",
    email: "ama@bank.com",
    phone: "0201234567",
  }),
};

describe("registerParticipant", () => {
  beforeEach(() => mockSend.mockReset());

  test("returns 200 with registrationNumber on success", async () => {
    // GetCommand (event lookup) → returns open event
    // QueryCommand (duplicate check) → returns empty
    // PutCommand (insert) → success
    mockSend
      .mockResolvedValueOnce({ Item: { eventId: "evt-123", name: "Summit", registrationOpen: true } })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({}); // audit

    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.registrationNumber).toBeDefined();
  });

  test("returns 400 when registration is closed", async () => {
    mockSend.mockResolvedValueOnce({ Item: { eventId: "evt-123", name: "Summit", registrationOpen: false } });
    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/closed/i);
  });

  test("returns 409 on duplicate email", async () => {
    mockSend
      .mockResolvedValueOnce({ Item: { eventId: "evt-123", name: "Summit", registrationOpen: true } })
      .mockResolvedValueOnce({ Items: [{ registrationId: "existing" }] });
    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(409);
  });

  test("returns 400 when fullName is missing", async () => {
    const res = await handler({
      ...baseEvent,
      body: JSON.stringify({ organisation: "Bank", email: "x@x.com" }),
    });
    expect(res.statusCode).toBe(400);
  });

  test("returns 400 when email is invalid", async () => {
    const res = await handler({
      ...baseEvent,
      body: JSON.stringify({ fullName: "Ama", organisation: "Bank", email: "not-an-email" }),
    });
    expect(res.statusCode).toBe(400);
  });

  test("handles OPTIONS preflight", async () => {
    const res = await handler({ httpMethod: "OPTIONS" });
    expect(res.statusCode).toBe(200);
  });
});
