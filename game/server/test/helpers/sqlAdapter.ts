// SqlStorage lookalike over node:sqlite, so the Store can be unit-tested outside workerd.
import { DatabaseSync } from "node:sqlite";

export function memorySql(): { sql: SqlStorage; tx: <T>(fn: () => T) => T } {
  const db = new DatabaseSync(":memory:");
  const sql = {
    exec(query: string, ...binds: unknown[]) {
      let rows: Record<string, unknown>[] = [];
      if (!binds.length && !/^\s*select/i.test(query)) db.exec(query);
      else if (/^\s*select/i.test(query)) rows = db.prepare(query).all(...(binds as never[])) as Record<string, unknown>[];
      else db.prepare(query).run(...(binds as never[]));
      return { toArray: () => rows, one: () => { if (rows.length !== 1) throw new Error("expected one row"); return rows[0]; } };
    },
  } as unknown as SqlStorage;
  const tx = <T>(fn: () => T): T => { db.exec("BEGIN"); try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } };
  return { sql, tx };
}
