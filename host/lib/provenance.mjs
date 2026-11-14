// Build provenance for the server bundle, checked with public endpoints only (no token, no gh):
//   1. GitHub's attestations REST API for a public repo (unauthenticated), falling back to the sigstore bundle
//      attached to the release (plain HTTPS download, not subject to the API's 60/h unauthenticated rate limit).
//   2. The bundle is verified with `sigstore` against the public-good trust root (Fulcio chain, Rekor inclusion / signed entry
//      timestamp, SCT): certificate issuer and source repository are pinned, the DSSE signature is checked.
//   3. The signed in-toto statement must name sha256(bundle tarball) as a subject, be SLSA provenance, and come from our workflow.
// Used by the launch step `cibuild` and by the fan host before it decrypts anything.
export const DEFAULT_REPO = "JenifaJoanna/last-save";
export const WORKFLOW_PATH = ".github/workflows/release-build.yml";
export const OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const OID_SOURCE_REPO_URI = "1.3.6.1.4.1.57264.1.12";
const SLSA_TYPES = new Set(["https://slsa.dev/provenance/v1", "https://slsa.dev/provenance/v0.2"]);
export const RELEASE_ASSET = "server-bundle.tar.gz";

/** code: unreachable | not_found | invalid | digest_mismatch */
export class ProvenanceError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export const tagForName = (name) => `build-${name}`;
export const releaseUrl = (repo, tag, asset) => `https://github.com/${repo}/releases/download/${tag}/${asset}`;
export const attestationsUrl = (repo, digest) => `https://api.github.com/repos/${repo}/attestations/sha256:${digest}?per_page=30`;

async function getJson(fetchImpl, url, why) {
  let res;
  try { res = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) }); }
  catch (e) { return { error: `${why} unreachable (${String(e.message).slice(0, 80)})`, kind: "unreachable" }; }
  if (res.status === 404) return { error: `${why}: HTTP 404`, kind: "not_found" };
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers?.get?.("x-ratelimit-reset") ?? 0);
    return { error: `${why}: HTTP ${res.status}${reset ? ` (rate limited until ${new Date(reset * 1000).toISOString().slice(11, 16)} UTC)` : ""}`, kind: "unreachable" };
  }
  if (!res.ok) return { error: `${why}: HTTP ${res.status}`, kind: "unreachable" };
  try { return { json: await res.json() }; } catch { return { error: `${why}: not JSON`, kind: "invalid" }; }
}

/** Candidate sigstore bundles for a digest: the REST API first, then the release asset. Returns { bundles: [{ bundle, source }], notes }. */
export async function fetchAttestationBundles({ repo = DEFAULT_REPO, digest, tag = null, fetchImpl = fetch }) {
  const bundles = [], notes = [];
  const api = await getJson(fetchImpl, attestationsUrl(repo, digest), "GitHub attestations API");
  if (api.json) {
    for (const a of api.json.attestations ?? []) if (a?.bundle) bundles.push({ bundle: a.bundle, source: "api.github.com attestations" });
    if (!bundles.length) notes.push("GitHub attestations API: no attestation for this digest");
  } else notes.push(api.error);
  if (!bundles.length && tag) {
    const rel = await getJson(fetchImpl, releaseUrl(repo, tag, `${RELEASE_ASSET}.sigstore.json`), `release asset ${tag}`);
    if (rel.json) bundles.push({ bundle: rel.json, source: `github release ${tag}` }); else notes.push(rel.error);
  }
  return { bundles, notes };
}

const defaultVerifyBundle = async (bundle, options) => (await import("sigstore")).verify(bundle, options);
const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

/** Pure: the facts of one verified bundle. Throws ProvenanceError("invalid") when the signed statement is not what we accept. */
export function readStatement(bundle, { repo, digest }) {
  const env = bundle?.dsseEnvelope;
  let st;
  try { st = JSON.parse(Buffer.from(env.payload, "base64").toString("utf8")); } catch { throw new ProvenanceError("invalid", "bundle has no readable in-toto statement"); }
  if (!SLSA_TYPES.has(st.predicateType)) throw new ProvenanceError("invalid", `unexpected predicate type ${st.predicateType}`);
  const subjects = (st.subject ?? []).map((s) => String(s?.digest?.sha256 ?? "").toLowerCase());
  if (!subjects.includes(String(digest).toLowerCase())) throw new ProvenanceError("digest_mismatch", `attested subject ${subjects[0]?.slice(0, 12) ?? "(none)"}… is not the on-chain build_hash ${String(digest).slice(0, 12)}…`);
  const p = st.predicate ?? {};
  const wf = p.buildDefinition?.externalParameters?.workflow ?? {};
  const dep = (p.buildDefinition?.resolvedDependencies ?? []).find((d) => d?.digest?.gitCommit) ?? {};
  const invocation = String(p.runDetails?.metadata?.invocationId ?? "");
  const entry = bundle?.verificationMaterial?.tlogEntries?.[0] ?? {};
  const tsa = bundle?.verificationMaterial?.timestampVerificationData?.rfc3161Timestamps?.length ?? 0;
  const integrated = num(entry.integratedTime);
  return {
    repo: String(wf.repository ?? "").replace(/^https:\/\/github\.com\//, "") || repo,
    workflow: String(wf.path ?? ""), ref: String(wf.ref ?? ""),
    commit: String(dep.digest?.gitCommit ?? ""),
    runId: /\/actions\/runs\/(\d+)/.exec(invocation)?.[1] ?? null, runUrl: invocation || null,
    rekorIndex: num(entry.logIndex), integratedTime: integrated ? new Date(integrated * 1000).toISOString() : null, rfc3161: tsa,
  };
}

/**
 * Finds a bundle that verifies and attests `digest`. Returns { ...statement facts, san, source }.
 * Throws ProvenanceError: unreachable / not_found (nothing to check) or invalid / digest_mismatch (something is wrong: refuse).
 */
export async function verifyProvenance({ digest, repo = DEFAULT_REPO, tag = null, fetchImpl = fetch, verifyBundle = defaultVerifyBundle, workflow = WORKFLOW_PATH }) {
  const { bundles, notes } = await fetchAttestationBundles({ repo, digest, tag, fetchImpl });
  if (!bundles.length) {
    const unreachable = notes.some((n) => !/HTTP 404|no attestation/.test(n));
    throw new ProvenanceError(unreachable ? "unreachable" : "not_found", notes.join("; ") || "no attestation found");
  }
  const reasons = [];
  let mismatches = 0;
  for (const { bundle, source } of bundles) {
    try {
      const facts = readStatement(bundle, { repo, digest });
      const signer = await verifyBundle(bundle, { certificateIssuer: OIDC_ISSUER, certificateOIDs: { [OID_SOURCE_REPO_URI]: `https://github.com/${repo}` } });
      const san = signer?.identity?.subjectAlternativeName ?? "";
      if (!san.startsWith(`https://github.com/${repo}/${workflow}@refs/tags/build-`)) throw new ProvenanceError("invalid", `signer identity ${san || "(none)"} is not the ${workflow} release workflow`);
      if (facts.workflow !== workflow) throw new ProvenanceError("invalid", `attested workflow ${facts.workflow} is not ${workflow}`);
      if (!/^[0-9a-f]{40}$/.test(facts.commit)) throw new ProvenanceError("invalid", "attestation carries no commit SHA");
      if (facts.rekorIndex === null && !facts.rfc3161) throw new ProvenanceError("invalid", "attestation has no transparency log entry or timestamp");
      return { ...facts, san, source };
    } catch (e) {
      if (e instanceof ProvenanceError && e.code === "digest_mismatch") mismatches++;
      reasons.push(`${source}: ${String(e.message).slice(0, 160)}`);
    }
  }
  throw new ProvenanceError(mismatches === reasons.length ? "digest_mismatch" : "invalid", reasons.join("; "));
}

/** `built by workflow <path> at commit <short>, logged <date> UTC (Rekor #<index>)` */
export function describeProvenance(p) {
  const when = p.integratedTime ? `${p.integratedTime.slice(0, 16).replace("T", " ")} UTC` : "(no log time)";
  return `built by workflow ${p.workflow} at commit ${p.commit.slice(0, 7)}, logged ${when} (Rekor #${p.rekorIndex ?? "n/a"})`;
}
