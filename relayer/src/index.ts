// Last Save gasless relayer (NEP-366). POST /relay { signed_delegate } -> { hash } | { error, code }. GET /health.
// The relayer account only pays gas: the user's signed actions cannot be changed, and the policy refuses anything
// outside the allowlisted zero-deposit holder methods of the allowlisted licence instances.
import { policyFrom, relayDelegate } from "./relay";
import { ATTACKS, runAttack, type AttackEnv as Env } from "./attack";
import { ALLOWED_METHODS, RelayError } from "./policy";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (pathname === "/health" && request.method === "GET") {
      return json(200, {
        ok: Boolean(env.RELAYER_ACCOUNT && env.RELAYER_KEY && env.ALLOWED_RECEIVERS),
        relayer: env.RELAYER_ACCOUNT ?? null,
        receivers: [...policyFrom(env).allowedReceivers],
        methods: [...ALLOWED_METHODS],
        attacks: env.ATTACKER_ACCOUNT ? Object.keys(ATTACKS) : [],
      });
    }
    if (pathname === "/attack") {
      if (request.method !== "POST") return json(405, { error: "use POST", code: "METHOD" });
      try {
        const text = await request.text();
        if (text.length > 2_000) throw new RelayError("BAD_REQUEST", "request too large", 413);
        let body: unknown;
        try { body = JSON.parse(text); } catch { throw new RelayError("BAD_REQUEST", "body must be JSON"); }
        return json(200, await runAttack(body, env));
      } catch (e) {
        if (e instanceof RelayError) return json(e.status, { error: e.message, code: e.code });
        return json(500, { error: "attack relay failed", code: "INTERNAL" });
      }
    }
    if (pathname === "/relay") {
      if (request.method !== "POST") return json(405, { error: "use POST", code: "METHOD" });
      try {
        const text = await request.text();
        if (text.length > 16_000) throw new RelayError("BAD_REQUEST", "request too large", 413);
        let body: unknown;
        try { body = JSON.parse(text); } catch { throw new RelayError("BAD_REQUEST", "body must be JSON"); }
        return json(200, await relayDelegate(body, env));
      } catch (e) {
        if (e instanceof RelayError) return json(e.status, { error: e.message, code: e.code });
        return json(500, { error: "relay failed", code: "INTERNAL" });
      }
    }
    return json(404, { error: "not found", code: "NOT_FOUND" });
  },
};
