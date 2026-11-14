// Forbidden identity terms shared by the identity gate (scripts/check-identity.mjs) and the film cast check
// (scripts/ops/check-cast.mjs). Stored base64-encoded so no file in the repo contains them.
const dec = (s) => Buffer.from(s, "base64").toString("utf8");

export const TERMS = [
  "Z2FicmllbGF4eQ==", "Z2FicmllbA==", "YW50b255", "eGF2aW91cg==", "Y29zbWljbGFu",
  "aW5qZWN0LnNo", "LmVudi5tYXN0ZXI=", "Y2xhdWRlL3ZhdWx0",
  "Ym9ubmV5", "bWFyc2VsYQ==", "amVza2lucw==", "a2Fpem9rdWpvZWw=", "cmF0bmE=",
  "Y2lwaGVya3VtYQ==", "Y2lwaGVyIGt1bWE=", "am9lbG9mZmJlYXQ=", "c3Bpbm9sYQ==",
  "ZGFydGhzdG9ybWVy", "ZGFydGggc3Rvcm1lcg==",
].map(dec);

/** The studio account's workers.dev subdomain: no Worker may answer on it. */
export const WORKERS_SUB = dec("Z2FicmllbGF4eQ==");

/** Extra words that must not appear on camera: the persona mailbox's local part. */
export const ON_CAMERA_TERMS = ["Y2FzaG91dA=="].map(dec);
