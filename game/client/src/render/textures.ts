// Procedural textures (no image assets needed): soft glows, sparks, rings, crystals.
import { Texture } from "pixi.js";

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (ctx) draw(ctx, size);
  return Texture.from(c);
}

function radial(ctx: CanvasRenderingContext2D, s: number, stops: [number, string][]): void {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

export interface Textures {
  glow: Texture;
  softGlow: Texture;
  spark: Texture;
  ring: Texture;
  shard: Texture;
  core: Texture;
  ember: Texture;
  nebula: Texture;
}

export function makeTextures(): Textures {
  return {
    glow: canvasTexture(128, (ctx, s) => radial(ctx, s, [[0, "rgba(255,255,255,1)"], [0.25, "rgba(255,255,255,0.55)"], [1, "rgba(255,255,255,0)"]])),
    softGlow: canvasTexture(256, (ctx, s) => radial(ctx, s, [[0, "rgba(255,255,255,0.5)"], [0.5, "rgba(255,255,255,0.12)"], [1, "rgba(255,255,255,0)"]])),
    spark: canvasTexture(32, (ctx, s) => radial(ctx, s, [[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,0.9)"], [1, "rgba(255,255,255,0)"]])),
    ember: canvasTexture(16, (ctx, s) => radial(ctx, s, [[0, "rgba(255,240,200,1)"], [0.5, "rgba(255,150,60,0.8)"], [1, "rgba(255,80,20,0)"]])),
    ring: canvasTexture(256, (ctx, s) => {
      ctx.strokeStyle = "rgba(255,255,255,1)";
      ctx.lineWidth = s * 0.035;
      ctx.shadowColor = "white";
      ctx.shadowBlur = s * 0.05;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    }),
    shard: canvasTexture(64, (ctx, s) => {
      const c = s / 2;
      const g = ctx.createLinearGradient(c - 10, c - 18, c + 10, c + 18);
      g.addColorStop(0, "#e9fdff");
      g.addColorStop(0.45, "#5ef0ff");
      g.addColorStop(1, "#1b6fff");
      ctx.shadowColor = "#5ef0ff";
      ctx.shadowBlur = 14;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(c, c - 20); ctx.lineTo(c + 11, c); ctx.lineTo(c, c + 20); ctx.lineTo(c - 11, c);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.moveTo(c, c - 20); ctx.lineTo(c + 4, c - 2); ctx.lineTo(c - 3, c - 4);
      ctx.closePath();
      ctx.fill();
    }),
    core: canvasTexture(128, (ctx, s) => {
      radial(ctx, s, [[0, "rgba(255,250,220,1)"], [0.18, "rgba(255,210,120,1)"], [0.38, "rgba(255,122,26,0.9)"], [0.7, "rgba(255,60,20,0.25)"], [1, "rgba(255,40,10,0)"]]);
    }),
    nebula: canvasTexture(512, (ctx, s) => radial(ctx, s, [[0, "rgba(255,255,255,0.32)"], [0.4, "rgba(255,255,255,0.1)"], [1, "rgba(255,255,255,0)"]])),
  };
}

/** Eight skiff colours, one per slot: readable on the dark arena and distinct for colour-blind viewers by pairing. */
export const SLOT_COLORS = [0xff4d6d, 0x4dd6ff, 0xa3ff5c, 0xffc94d, 0xb48cff, 0xff8c42, 0x42ffc9, 0xff6ad5];
export const SLOT_CSS = SLOT_COLORS.map((c) => `#${c.toString(16).padStart(6, "0")}`);
export const EMBER = 0xff7a1a;
export const SHARD_CYAN = 0x5ef0ff;
