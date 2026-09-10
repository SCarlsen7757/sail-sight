import { csrfHeaders, browserRequest } from "./browser-request";
import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./api-types";

// Browser uses same-origin "/api/*"; server-side rendering uses internal API_BASE_URL.
const isServer = typeof window === "undefined";
const baseUrl = isServer
  ? (process.env.API_BASE_URL ?? "http://localhost:5223")
  : "";

const errorMiddleware: Middleware = {
  async onRequest({ request }) {
    csrfHeaders(request.method, request.headers).forEach((value, key) => request.headers.set(key, value));
    return request;
  },
  async onResponse({ response }) {
    if (!response.ok && response.status >= 500) {
      // Surface server errors with a friendlier message; consumers handle 4xx.
      console.error(`[api] ${response.status} ${response.url}`);
    }
    return response;
  },
};

export const api = createClient<paths>({ baseUrl, fetch: browserRequest });
api.use(errorMiddleware);

export type ApiPaths = paths;
