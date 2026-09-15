import createClient, { type Client } from "openapi-fetch";
import type { paths } from "../../src/lib/api-types";
import { browserRequest } from "../../src/lib/browser-request";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_COOKIE = "sailsight.csrf";

interface StoredCookie {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
  expires: number;
}

/** Playwright storageState shape (kept local so the seeder does not depend on @playwright/test). */
export interface StorageState {
  cookies: (StoredCookie & { domain: string; path: string })[];
  origins: never[];
}

export type ApiClient = Client<paths> & {
  /** Exports the session cookies as a Playwright storageState. */
  storageState(): StorageState;
};

function parseSetCookie(header: string): StoredCookie | null {
  const [pair, ...attributes] = header.split(";");
  const separator = pair.indexOf("=");
  if (separator <= 0) return null;
  const cookie: StoredCookie = {
    name: pair.slice(0, separator).trim(),
    value: pair.slice(separator + 1).trim(),
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
    expires: -1,
  };
  for (const attribute of attributes) {
    const [rawKey, ...rest] = attribute.split("=");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join("=").trim();
    if (key === "httponly") cookie.httpOnly = true;
    else if (key === "secure") cookie.secure = true;
    else if (key === "samesite") cookie.sameSite = (value[0]?.toUpperCase() + value.slice(1).toLowerCase()) as StoredCookie["sameSite"];
    else if (key === "max-age") cookie.expires = Math.floor(Date.now() / 1000) + Number(value);
    else if (key === "expires" && cookie.expires === -1) cookie.expires = Math.floor(Date.parse(value) / 1000);
  }
  return cookie;
}

/**
 * A typed API client with its own cookie jar. It sends the Origin header and the
 * X-CSRF-Token header the API requires, the same way a browser on the web origin would.
 */
export function createApiClient(baseUrl: string): ApiClient {
  const origin = new URL(baseUrl).origin;
  const jar = new Map<string, StoredCookie>();
  // browserRequest follows X-Next-Offset continuations, so list endpoints return every item.
  const client = createClient<paths>({ baseUrl, fetch: browserRequest });

  client.use({
    onRequest({ request }) {
      const now = Date.now() / 1000;
      const live = [...jar.values()].filter(c => c.expires === -1 || c.expires > now);
      if (live.length) request.headers.set("Cookie", live.map(c => `${c.name}=${c.value}`).join("; "));
      request.headers.set("Origin", origin);
      const csrf = jar.get(CSRF_COOKIE);
      if (csrf && !SAFE.has(request.method)) request.headers.set("X-CSRF-Token", decodeURIComponent(csrf.value));
      return request;
    },
    onResponse({ response }) {
      for (const header of response.headers.getSetCookie()) {
        const cookie = parseSetCookie(header);
        if (!cookie) continue;
        if (cookie.expires !== -1 && cookie.expires <= Date.now() / 1000) jar.delete(cookie.name);
        else jar.set(cookie.name, cookie);
      }
      return response;
    },
  });

  const domain = new URL(baseUrl).hostname;
  return Object.assign(client, {
    storageState: (): StorageState => ({
      cookies: [...jar.values()].map(c => ({ ...c, domain, path: "/" })),
      origins: [],
    }),
  });
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly body: unknown, context: string) {
    super(`${context} failed with HTTP ${status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
}

/** Error code from an API error body ({ error: "code" }), if any. */
export function errorCode(body: unknown): string | undefined {
  return typeof body === "object" && body !== null && "error" in body ? String((body as { error: unknown }).error) : undefined;
}

/** Returns the response data, or throws ApiError with the response body. */
export function ok<T>(result: { data?: T; error?: unknown; response: Response }, context: string): T {
  if (!result.response.ok) throw new ApiError(result.response.status, result.error, context);
  return result.data as T;
}
