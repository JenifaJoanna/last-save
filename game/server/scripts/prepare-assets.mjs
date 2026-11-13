// Fills .assets/ with the built game client (../client/dist) or, until it exists, the placeholder page.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const client = join(root, "..", "client", "dist");
const out = join(root, ".assets");
const source = existsSync(join(client, "index.html")) ? client : join(root, "placeholder");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(source, out, { recursive: true });
process.stdout.write(`assets: ${source === client ? "game client" : "placeholder page"} -> .assets\n`);
