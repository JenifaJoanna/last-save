import { describe, expect, it } from "vitest";
import { putSnapshot } from "../../src/walrus";

const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe("snapshot mirror to Walrus", () => {
  it("PUTs the exact JSON bytes with epochs=53&permanent=true and returns the blob id", async () => {
    let seen: { url: string; body: string } | null = null;
    const f = (async (url: string, init: RequestInit) => { seen = { url, body: new TextDecoder().decode(init.body as Uint8Array) }; return new Response(JSON.stringify({ newlyCreated: { blobObject: { blobId: "B1" } } })); }) as unknown as typeof fetch;
    const r = await putSnapshot('{"seq":1}', "https://pub.example", f);
    expect(r).toEqual({ ok: true, blobId: "B1", error: null });
    expect(seen).toEqual({ url: "https://pub.example/v1/blobs?epochs=53&permanent=true", body: '{"seq":1}' });
  });
  it("accepts alreadyCertified, and reports failures without throwing", async () => {
    expect((await putSnapshot("{}", "https://pub.example", ok({ alreadyCertified: { blobId: "B2" } }))).blobId).toBe("B2");
    expect((await putSnapshot("{}", "https://pub.example", (async () => new Response("no", { status: 503 })) as unknown as typeof fetch)).error).toBe("publisher HTTP 503");
    expect((await putSnapshot("{}", "https://pub.example", (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).error).toBe("offline");
    expect((await putSnapshot("{}", "https://pub.example", ok({ nope: 1 }))).ok).toBe(false);
  });
  it("is disabled by 'off'", async () => {
    expect(await putSnapshot("{}", "off", (async () => { throw new Error("must not be called"); }) as unknown as typeof fetch)).toMatchObject({ ok: false, error: "disabled" });
  });
});
