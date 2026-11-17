// Boot: pick which store the root opens on (lib/standby.ts), then load the app. The pick must happen first, because the
// licence contract is fixed when near.ts is first imported.
import { pickStandby } from "./lib/standby";

await pickStandby().catch(() => undefined);
await import("./app");
