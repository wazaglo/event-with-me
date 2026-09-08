import { getSession } from "./auth/cognito-client";

const BASE_URL = import.meta.env.VITE_API_URL as string;
const REQUEST_TIMEOUT_MS = 15_000;

async function authHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  if (!session) return { "Content-Type": "application/json" };
  return { "Content-Type": "application/json", Authorization: `Bearer ${session.idToken}` };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers = await authHeaders();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
    return data as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Events ────────────────────────────────────────────────────────────────────

export interface ApiEvent {
  eventId: string;
  name: string;
  date: string | null;
  venue: string | null;
  description: string | null;
  registrationOpen: boolean;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  showQr: boolean;
  showRegistrationNumber: boolean;
  badgeFontSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventBody {
  name: string;
  date?: string | null;
  venue?: string | null;
  description?: string | null;
  registrationOpen?: boolean;
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string | null;
  showQr?: boolean;
  showRegistrationNumber?: boolean;
  badgeFontSize?: number;
}

export type UpdateEventBody = Partial<CreateEventBody>;

export const eventsApi = {
  list: () => request<ApiEvent[]>("GET", "/events"),
  create: (body: CreateEventBody) => request<ApiEvent>("POST", "/events", body),
  update: (eventId: string, body: UpdateEventBody) =>
    request<ApiEvent>("PUT", `/events/${eventId}`, body),
};

// ── Registrations ─────────────────────────────────────────────────────────────

export interface ApiRegistration {
  registrationId: string;
  eventId: string;
  registrationNumber: string;
  fullName: string;
  organisation: string;
  email: string;
  phone: string | null;
  position: string | null;
  registrationType: "online" | "walk_in";
  checkedInAt: string | null;
  checkedInBy: string | null;
  badgePrintedAt: string | null;
  badgePrintCount: number;
  createdAt: string;
  updatedAt: string;
}

export const registrationsApi = {
  register: (
    eventId: string,
    body: {
      fullName: string;
      organisation: string;
      email: string;
      phone?: string;
      position?: string;
    },
  ) =>
    request<{ registrationNumber: string; registrationId: string }>(
      "POST",
      `/events/${eventId}/register`,
      body,
    ),

  list: (eventId: string, params?: { search?: string; type?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.type) qs.set("type", params.type);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return request<ApiRegistration[]>("GET", `/events/${eventId}/registrations${q ? `?${q}` : ""}`);
  },

  getById: (id: string) => request<ApiRegistration>("GET", `/registrations/${id}`),

  getByEmail: (email: string) =>
    request<ApiRegistration[]>("GET", `/registrations/by-email/${encodeURIComponent(email)}`),

  update: (id: string, body: Partial<ApiRegistration>) =>
    request<ApiRegistration>("PUT", `/registrations/${id}`, body),

  delete: (id: string) => request<{ deleted: boolean }>("DELETE", `/registrations/${id}`),

  checkIn: (id: string) => request<ApiRegistration>("POST", `/registrations/${id}/checkin`),

  walkIn: (
    eventId: string,
    body: {
      fullName: string;
      organisation: string;
      email: string;
      phone?: string;
      position?: string;
    },
  ) => request<ApiRegistration>("POST", `/events/${eventId}/walk-in`, body),

  printBadge: (id: string) =>
    request<{ badgePrintedAt: string; badgePrintCount: number }>(
      "POST",
      `/registrations/${id}/print`,
    ),
};

// ── Audit ─────────────────────────────────────────────────────────────────────

export interface ApiAuditLog {
  auditId: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  actorId: string | null;
  actorLabel: string | null;
  meta: { name?: string; email?: string; phone?: string; reg?: string } & Record<string, unknown>;
  createdAt: string;
}

export const auditApi = {
  list: (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : "";
    return request<ApiAuditLog[]>("GET", `/audit${qs}`);
  },
};
