import { ok, created, badRequest, forbidden, notFound, conflict, serverError, cors } from "../shared/response.mjs";

describe("response helpers", () => {
  test("ok returns 200", () => {
    const res = ok({ key: "value" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).key).toBe("value");
    expect(res.headers["Access-Control-Allow-Origin"]).toBeDefined();
  });

  test("created returns 201", () => {
    expect(created({}).statusCode).toBe(201);
  });

  test("badRequest returns 400 with error", () => {
    const res = badRequest("missing field");
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("missing field");
  });

  test("forbidden returns 403", () => {
    expect(forbidden().statusCode).toBe(403);
  });

  test("notFound returns 404", () => {
    expect(notFound().statusCode).toBe(404);
  });

  test("conflict returns 409", () => {
    expect(conflict("dup").statusCode).toBe(409);
  });

  test("serverError returns 500", () => {
    expect(serverError().statusCode).toBe(500);
  });

  test("cors returns 200 with empty body", () => {
    const res = cors();
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("");
  });
});
