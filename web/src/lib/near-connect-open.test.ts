// Run: node --test web/src/lib/near-connect-open.test.ts
// The pnpm patch on @hot-labs/near-connect@0.12.0 (patches/@hot-labs__near-connect@0.12.0.patch) makes a wallet's
// "open" request (Meteor web, Ethereum Wallets) a new tab in the same window: window.open(url, "_blank") with no
// features string (a features string makes browsers open a sized popup window) and the opener kept.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(new URL("../../package.json", import.meta.url));

test("a wallet's open request calls window.open(url, \"_blank\") with no features", async () => {
  const calls: unknown[][] = [];
  const fakeTab = { closed: false };
  const g = globalThis as unknown as { window?: unknown };
  const prev = g.window;
  g.window = {
    open: (...args: unknown[]) => { calls.push(args); return fakeTab; },
    addEventListener: () => {}, removeEventListener: () => {},
  };
  try {
    const Executor = require("@hot-labs/near-connect/build/SandboxedWallet/executor.js").default;
    const manifest = { id: "meteor-wallet", permissions: { allowsOpen: ["https://wallet.meteorwallet.app"] } };
    const ex = new Executor({}, manifest);
    const posted: unknown[] = [];
    const iframe = { postMessage: (m: unknown) => posted.push(m), show() {}, hide() {} };
    const url = "https://wallet.meteorwallet.app/connect?request=abc";
    await ex._onMessage(iframe, { data: { method: "open", id: 1, params: { url, features: "width=400,height=640,left=10,top=10" } } });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], [url, "_blank"], "exactly (url, \"_blank\"): no features string, so no popup window and the opener stays");
    assert.equal((posted[0] as { status?: string }).status, "success", "the wallet gets a window id back so it can track the tab");
    // Closing the tab without approving: the executor notices (500 ms poll) and tells the wallet, which cancels.
    fakeTab.closed = true;
    await new Promise((r) => setTimeout(r, 700));
    assert.ok(posted.some((m) => (m as { method?: string }).method === "proxy-window:closed"), "a closed tab is reported to the wallet");
  } finally {
    g.window = prev;
  }
});

test("an open request outside the wallet's allowsOpen list is refused and opens nothing", async () => {
  const calls: unknown[][] = [];
  const g = globalThis as unknown as { window?: unknown };
  const prev = g.window;
  g.window = { open: (...a: unknown[]) => { calls.push(a); return null; }, addEventListener: () => {}, removeEventListener: () => {} };
  try {
    const Executor = require("@hot-labs/near-connect/build/SandboxedWallet/executor.js").default;
    const ex = new Executor({}, { id: "meteor-wallet", permissions: { allowsOpen: ["https://wallet.meteorwallet.app"] } });
    const iframe = { postMessage: () => {}, show() {}, hide() {} };
    await assert.rejects(ex._onMessage(iframe, { data: { method: "open", id: 2, params: { url: "https://evil.example/" } } }));
    assert.equal(calls.length, 0);
  } finally {
    g.window = prev;
  }
});
