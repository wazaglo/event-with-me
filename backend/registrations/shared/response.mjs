const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";

const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

export function ok(body) {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(body) };
}

export function created(body) {
  return { statusCode: 201, headers: CORS, body: JSON.stringify(body) };
}

export function badRequest(message) {
  return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: message }) };
}

export function forbidden(message = "Forbidden") {
  return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: message }) };
}

export function notFound(message = "Not Found") {
  return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: message }) };
}

export function conflict(message) {
  return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: message }) };
}

export function serverError(message = "Internal Server Error") {
  return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: message }) };
}

export function cors() {
  return { statusCode: 200, headers: CORS, body: "" };
}
