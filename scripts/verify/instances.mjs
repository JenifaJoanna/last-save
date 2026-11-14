// Instance configuration for `pnpm verify`: which account, which kind, which pins, which proof manifests.
// Any account id works; unknown ids are treated as a factory instance when they end in the factory suffix, else as a v1-style contract.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const CONFIG = JSON.parse(readFileSync(join(ROOT, "scripts/verify/instances.json"), "utf8"));

export function resolveInstance(input, config = CONFIG) {
  const id = input.includes(".") ? input : `${input}.${config.factory}`;
  const known = config.instances[id] ?? {};
  const kind = known.kind ?? (id.endsWith(`.${config.factory}`) ? "factory" : "v1");
  const name = id.split(".")[0];
  return {
    id, kind, name, label: known.label ?? `${kind} instance`, factory: config.factory,
    codeSha256: known.codeSha256 ?? null, globalCodeHash: config.globalCodeHash,
    manifests: known.manifests ?? [`proof/launch-${name}.json`, `proof/judge-${name}.json`],
    buildTag: kind === "factory" ? `build-${name}` : null, repo: config.repo, studio: config.studio,
  };
}

/** Existing manifest files for an instance (a trailing * in the file name globs). Missing ones are simply absent: not every instance has every proof. */
export function manifestFiles(inst, root = ROOT) {
  const out = [];
  for (const rel of inst.manifests) {
    const dir = dirname(join(root, rel)), base = rel.split("/").pop();
    if (!base.includes("*")) { if (existsSync(join(root, rel))) out.push(rel); continue; }
    if (!existsSync(dir)) continue;
    const re = new RegExp(`^${base.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
    for (const f of readdirSync(dir).sort()) if (re.test(f)) out.push(`${dirname(rel)}/${f}`);
  }
  return out;
}

export const readManifest = (rel, root = ROOT) => readFileSync(join(root, rel), "utf8");
