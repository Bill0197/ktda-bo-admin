/* Shared fetch primitive for every domain-sliced api.*.ts file. Same
 * fetch/cookie/error-envelope conventions as coreApi.ts (the auth primitive);
 * this is everything built on top of a session it already established. */

const CORE_API_BASE = import.meta.env.VITE_CORE_API_BASE ?? "http://localhost:8090";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${CORE_API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, `Cannot reach CORE API at ${CORE_API_BASE}. Is it running?`);
  }
  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    const env = (body ?? {}) as { error?: string; code?: string; message?: string };
    throw new ApiError(res.status, env.message ?? env.error ?? res.statusText, env.code);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

export const get = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
export const del = <T>(path: string) => request<T>(path, { method: "DELETE" });
