// Which licence instance this tab shows, in words, and how to switch. Switching is a full load (the instance is picked
// once at load, see near.ts), so every hook and wallet key starts clean for the new contract.
import { CONTRACT, DEFAULT_CONTRACT, IS_DEFAULT_INSTANCE } from "./near";

/** The instance the judges were shown in the submission: launched, played, shut down and released on camera. */
export const JUDGES_INSTANCE = "ember-rift";
const LABELS: Record<string, string> = {
  live: "Live store",
  "ember-rift": "Judges' instance, as filmed",
  v2dev: "Dev instance",
};

export const instanceName = (account: string = CONTRACT) => account.split(".")[0];
export function instanceLabel(account: string = CONTRACT): string {
  const n = instanceName(account);
  return LABELS[n] ?? (n.startsWith("sbx-") ? "Your own copy" : n);
}
export const isJudgesInstance = (account: string = CONTRACT) => instanceName(account) === JUDGES_INSTANCE;
export const onDefault = IS_DEFAULT_INSTANCE;
export const defaultName = instanceName(DEFAULT_CONTRACT);
/** Full-page switch; "default" returns to the build's default instance. */
export const instanceHref = (name: string, path = "/") => `${path}?instance=${encodeURIComponent(name)}`;
