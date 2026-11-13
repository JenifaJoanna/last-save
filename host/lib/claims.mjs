// Finds completed epochs this host has not been paid for.
const num = (v) => (v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export function currentEpoch(info) { return num(info?.current_epoch ?? info?.epoch ?? null); }

export function claimableEpochs({ info, claims, account }) {
  const cur = currentEpoch(info);
  if (cur === null) return [];
  const done = new Set((claims ?? []).filter((c) => (c.host_id ?? c.host) === account).map((c) => num(c.epoch)));
  const out = [];
  for (let e = 0; e < cur; e++) if (!done.has(e)) out.push(e);
  return out;
}
