import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { port: 5173, fs: { allow: [".."] } },
  build: { outDir: "dist", sourcemap: false, target: "es2022", chunkSizeWarningLimit: 1500 },
});
