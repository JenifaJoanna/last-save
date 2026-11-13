// Copies the built game client into the web build at /play so the platform can show and launch the game.
import { cpSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const client = join(root, "..", "game", "client", "dist");
if (!existsSync(client)) {
  process.stderr.write("copy-play: game/client/dist missing; run the client build first\n");
  process.exit(1);
}
cpSync(client, join(root, "dist", "play"), { recursive: true });
const artifacts = join(root, "..", "artifacts");
if (existsSync(artifacts)) cpSync(artifacts, join(root, "dist", "mirror"), { recursive: true });
writeFileSync(join(root, "dist", "_redirects"), "/play/* /play/index.html 200\n/* /index.html 200\n");
process.stdout.write("copy-play: game client copied to dist/play\n");
