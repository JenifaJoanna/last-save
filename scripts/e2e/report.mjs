// Run report: phases, tx hashes with explorer links, readbacks and pass/fail per assertion. Written after every phase.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { log, nowIso } from "./util.mjs";

const safe = (_k, v) => (typeof v === "bigint" ? v.toString() : v);

export class Report {
  /** `append`: continue the report already at `file` (a resumed run with --from keeps the phases that ran before). */
  constructor({ file, meta, append = false }) {
    this.file = file;
    this.data = { started_at: nowIso(), ...meta, phases: [], unenforced: [] };
    if (append && existsSync(file)) {
      const old = JSON.parse(readFileSync(file, "utf8"));
      this.data = { ...old, ...meta, started_at: old.started_at, balances_start: old.balances_start, phases: old.phases ?? [], resumed_at: [...(old.resumed_at ?? []), nowIso()] };
      delete this.data.totals;
    }
    this.cur = null;
    mkdirSync(dirname(file), { recursive: true });
  }

  phase(name, title) {
    const old = this.data.phases.findIndex((p) => p.name === name);
    if (old >= 0) (this.data.superseded ??= []).push(...this.data.phases.splice(old, 1)); // a rerun replaces the earlier attempt, which stays on record
    this.cur = { name, title, started_at: nowIso(), status: "running", txs: [], readback: {}, assertions: [], notes: [] };
    this.data.phases.push(this.cur);
    log(`--- phase ${name}: ${title}`);
    this.flush();
    return this.cur;
  }

  check(name, pass, detail = "") {
    const a = { name, pass: Boolean(pass), detail: String(detail).slice(0, 400) };
    this.cur.assertions.push(a);
    log(`  ${a.pass ? "PASS" : "FAIL"}  ${name}${detail ? ` (${a.detail})` : ""}`);
    return a.pass;
  }

  tx(label, r) {
    const t = { label, hash: r.hash, url: r.url, failure: r.failure ? JSON.stringify(r.failure, safe).slice(0, 300) : null };
    this.cur.txs.push(t);
    log(`  tx ${label}: ${r.url}${t.failure ? `  (refused: ${t.failure.slice(0, 120)})` : ""}`);
    return t;
  }

  read(key, value) { this.cur.readback[key] = value; }
  note(msg) { this.cur.notes.push(msg); log(`  note: ${msg}`); }

  end(status) {
    const failed = this.cur.assertions.some((a) => !a.pass);
    this.cur.status = status ?? (failed ? "failed" : "passed");
    this.cur.ended_at = nowIso();
    this.flush();
    return this.cur.status;
  }

  flush() {
    writeFileSync(this.file, JSON.stringify({ ...this.data, totals: this.totals() }, safe, 2) + "\n");
  }

  totals() {
    const all = this.data.phases.flatMap((p) => p.assertions);
    return {
      assertions: all.length,
      passed: all.filter((a) => a.pass).length,
      failed: all.filter((a) => !a.pass).length,
      phases_passed: this.data.phases.filter((p) => p.status === "passed").length,
      phases_failed: this.data.phases.filter((p) => p.status === "failed" || p.status === "error").length,
    };
  }

  /** Final table: every phase passed / failed / not covered, plus rules with no check. */
  summary(allPhases) {
    const ran = new Map(this.data.phases.map((p) => [p.name, p]));
    const rows = allPhases.map(({ name, title }) => {
      const p = ran.get(name);
      if (!p) return { name, title, state: "NOT COVERED", detail: "not run in this invocation" };
      const bad = p.assertions.filter((a) => !a.pass);
      const state = p.status === "passed" ? "PASSED" : p.status === "error" ? "ERROR" : "FAILED";
      const detail = `${p.assertions.length - bad.length}/${p.assertions.length} assertions${bad.length ? `; failed: ${bad.map((a) => a.name).join(", ")}` : ""}`;
      return { name, title, state, detail };
    });
    const t = this.totals();
    const lines = ["", "Phase  Result        Detail"];
    for (const r of rows) lines.push(`${r.name.padEnd(13)} ${r.state.padEnd(12)} ${r.title}: ${r.detail}`);
    lines.push(`Totals: ${t.passed} passed, ${t.failed} failed, ${rows.filter((r) => r.state === "NOT COVERED").length} phases not covered`);
    if (this.data.unenforced.length) lines.push(`Unenforced rules (no check ran): ${this.data.unenforced.join("; ")}`);
    lines.push(`Report: ${this.file}`);
    process.stdout.write(lines.join("\n") + "\n");
    return { rows, totals: t };
  }
}
