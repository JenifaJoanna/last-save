// Worker entry: API and WebSocket traffic goes to the single global Arena; everything else is the static client.
import type { Env } from "./env";
import { errorJson, preflight } from "./http";

export { Arena } from "./arena";

const API = new Set(["/health", "/attest", "/profile", "/ws"]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (API.has(url.pathname)) {
        if (request.method === "OPTIONS") return preflight();
        if (request.method !== "GET") return errorJson(405, "method not allowed", "method_not_allowed");
        return await env.ARENA.get(env.ARENA.idFromName("arena")).fetch(request);
      }
      if (request.method !== "GET" && request.method !== "HEAD") return errorJson(405, "method not allowed", "method_not_allowed");
      return await env.ASSETS.fetch(request);
    } catch {
      return errorJson(500, "internal error", "internal");
    }
  },
} satisfies ExportedHandler<Env>;
