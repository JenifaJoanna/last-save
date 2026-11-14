// Run-specific values for the film, read from run-facts.json (written by scripts/facts.mjs from the proof files).
// A key that could not be read is null in the JSON and prints as MISSING·key, so it can never pass for a real value;
// scripts/final-gate.mjs refuses to ship while the JSON lists any.
import RUN from "./run-facts.json";
import AFTER from "./run-facts-after.json";

export type RunKey = keyof typeof RUN.values;
/** The instance this film shows (the run's contract). */
export const RUN_INSTANCE: string = RUN.instance;
/** A run value as text. */
export const rs = (k: RunKey): string => String(RUN.values[k] ?? `MISSING·${k}`);
/** A run value as a number. */
export const rn = (k: RunKey): number => Number(RUN.values[k] ?? NaN);
/** `abcd1234…wxyz` form of a hash or id (8 head, 4 tail), as the film prints them. */
export const shortHash = (s: string, head = 8, tail = 4) => (s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`);
/** The verify check statuses by row label (pass | na | warn | fail). */
export const VERIFY_MARKS: Record<string, string> = (RUN.values.verifyMarks ?? {}) as Record<string, string>;

// The afterlife (S10, S12-S16) is v2dev's real run: same global code, and it completed the release, the Walrus/IA copy,
// the fan host, the epoch claim and the Base payout on 14 Nov. Its values come from run-facts-after.json.
/** The instance whose afterlife S10 and S12-S16 show. */
export const RUN_AFTER_INSTANCE: string = AFTER.instance;
/** An afterlife value as text (prints MISSING·key while the after facts list it as missing). */
export const ra = (k: keyof typeof AFTER.values): string => String(AFTER.values[k] ?? `MISSING·${k}`);
/** An afterlife value as a number. */
export const ran = (k: keyof typeof AFTER.values): number => Number(AFTER.values[k] ?? NaN);
/** The afterlife verify check statuses by row label (pass | na | warn | fail). */
export const RA_VERIFY_MARKS: Record<string, string> = (AFTER.values.verifyMarks ?? {}) as Record<string, string>;
