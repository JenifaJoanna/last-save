// HTTP helpers and the read-only endpoints (/health, /attest, /profile). Errors are { error, code }.
import { ZodError } from "zod";
import type { Config } from "./env";
import { accountIdSchema, attestQuerySchema } from "./schemas";
import type { Store } from "./store";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" };

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS, ...extra } });
export const errorJson = (status: number, error: string, code?: string): Response => json(code ? { error, code } : { error }, status);
export const preflight = (): Response => new Response(null, { status: 204, headers: CORS });

export function handleProfile(url: URL, store: Store): Response {
  const account = accountIdSchema.safeParse(url.searchParams.get("account") ?? "");
  if (!account.success) return errorJson(400, "account must be a NEAR account id", "bad_account");
  const p = store.profile(account.data);
  return json({ account_id: p.account_id, level: p.level, xp: p.xp, skin: p.skin, matches: p.matches });
}

export function handleAttest(url: URL, store: Store, cfg: Config, nowMs: number): Response {
  let q;
  try {
    q = attestQuerySchema.parse(Object.fromEntries([...url.searchParams].filter(([, v]) => v !== "")));
  } catch (e) {
    return errorJson(400, e instanceof ZodError ? "invalid attest query" : "bad request", "bad_query");
  }
  if (q.host !== undefined && q.host !== cfg.hostId) return errorJson(400, `this server is host "${cfg.hostId}"`, "wrong_host");
  const sessions = store.sessions({ fromMs: q.from, toMs: q.to, epoch: q.epoch });
  return json({ host_id: cfg.hostId, build_hash: cfg.buildHash, nonce: q.nonce ?? "", now_ms: nowMs, sessions });
}
