import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./api-types";

// Browser uses same-origin "/api/*"; server-side rendering uses internal API_BASE_URL.
const isServer = typeof window === "undefined";
const baseUrl = isServer
  ? (process.env.API_BASE_URL ?? "http://localhost:5223")
  : "";

const errorMiddleware: Middleware = {
  async onResponse({ response }) {
    if (!response.ok && response.status >= 500) {
      // Surface server errors with a friendlier message; consumers handle 4xx.
      console.error(`[api] ${response.status} ${response.url}`);
    }
    return response;
  },
};

export const api = createClient<paths>({ baseUrl });
api.use(errorMiddleware);

export type ApiPaths = paths;
