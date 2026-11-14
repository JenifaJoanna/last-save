// Run-specific values for the film, read from run-facts.json (written by scripts/facts.mjs from the proof files).
// A key that could not be read is null in the JSON and prints as MISSING·key, so it can never pass for a real value;
// scripts/final-gate.mjs refuses to ship while the JSON lists any.
import RUN from "./run-facts.json";

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
