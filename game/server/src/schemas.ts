// zod schemas for every inbound boundary: WebSocket messages and HTTP queries.
import { z } from "zod";

const accountId = z.string().min(2).max(64).regex(/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/);
const b64 = (max: number) => z.string().max(max).regex(/^[A-Za-z0-9+/]*={0,2}$/);

export const loginSchema = z.object({
  account_id: accountId,
  public_key: z.string().min(10).max(80).startsWith("ed25519:"),
  signature: b64(100),
  message: z.string().min(10).max(600),
  nonce: b64(60),
  recipient: accountId,
});

export const receiptSchema = z.object({
  host: z.string().min(1).max(64),
  epoch: z.number().int().nonnegative().nullable(),
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
  ts_ms: z.number().int().nonnegative(),
  account_id: accountId,
  signature: b64(100),
});

export const clientMsgSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("hello"),
    v: z.number().int(),
    login: loginSchema,
    proof: z.object({ ts_ms: z.number().int().nonnegative(), signature: b64(100) }),
  }),
  z.object({
    t: z.literal("input"),
    seq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    ax: z.number().finite().min(-1000).max(1000),
    ay: z.number().finite().min(-1000).max(1000),
    dash: z.boolean(),
  }),
  z.object({ t: z.literal("receipt"), receipt: receiptSchema }),
  z.object({ t: z.literal("ping"), c: z.number().finite() }),
]);

export const profileQuerySchema = z.object({ account: accountId });

const optInt = z.string().regex(/^\d{1,16}$/).transform(Number).optional();
export const attestQuerySchema = z.object({
  nonce: z.string().max(128).optional(),
  host: z.string().max(64).optional(),
  from: optInt,
  to: optInt,
  epoch: optInt,
});

export const restoreSchema = z.object({
  seq: z.number().int().nonnegative(),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  blob_base64: z.string().max(40_000),
});

export const snapshotBlobSchema = z.object({
  at_ms: z.number().int(),
  game: z.literal("ember-rift"),
  players: z.record(accountId, z.object({
    kos: z.number().int().nonnegative(), level: z.number().int().positive(), matches: z.number().int().nonnegative(),
    shards: z.number().int().nonnegative(), skin: z.enum(["standard", "emberwing"]), xp: z.number().int().nonnegative(),
  })),
  seq: z.number().int().nonnegative(),
});

export const accountIdSchema = accountId;
