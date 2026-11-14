// Public face of the relayer: a Pages project (so the URL is <name>.pages.dev). Every request is forwarded to the
// relayer Worker through the RELAYER service binding; the Worker itself has no public URL.
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/relay" || pathname === "/health") return env.RELAYER.fetch(request);
    if (request.method === "OPTIONS") return env.RELAYER.fetch(request);
    return new Response("Last Save relayer. POST /relay, GET /health.\n", { status: 200, headers: { "content-type": "text/plain" } });
  },
};
