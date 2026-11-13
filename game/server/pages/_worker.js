// Public face of a deployment: a Pages project. API and WebSocket traffic is forwarded to the game Worker
// through the ARENA service binding (the Worker itself has no public URL); everything else is the static client.
const API = new Set(["/health", "/attest", "/profile", "/ws"]);

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (API.has(pathname)) return env.ARENA.fetch(request);
    return env.ASSETS.fetch(request);
  },
};
