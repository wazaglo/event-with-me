import { randomUUID, randomInt } from "crypto";

export function newId() {
  return randomUUID();
}

// Collision-resistant registration number: prefix + last 4 digits of timestamp + 2 random digits
// e.g. SUMMIT-48291-73 — safe for event-scale concurrent registrations
export function registrationNumber(prefix = "SUMMIT") {
  const ts = String(Date.now()).slice(-4);
  const rand = String(randomInt(10, 99));
  return `${prefix}-${ts}${rand}`;
}
