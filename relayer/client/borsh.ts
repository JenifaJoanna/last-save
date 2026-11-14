// Minimal borsh reader/writer. Browser and Worker safe (no Node APIs).

export class Writer {
  private parts: number[] = [];
  u8(n: number) { this.parts.push(n & 0xff); return this; }
  uint(n: bigint, bytes: number) {
    for (let i = 0; i < bytes; i++) this.parts.push(Number((n >> BigInt(8 * i)) & 0xffn));
    return this;
  }
  bytes(b: Uint8Array) { for (const x of b) this.parts.push(x); return this; }
  vec(b: Uint8Array) { this.uint(BigInt(b.length), 4); return this.bytes(b); }
  str(s: string) { return this.vec(new TextEncoder().encode(s)); }
  done() { return Uint8Array.from(this.parts); }
}

export class Reader {
  private pos = 0;
  private buf: Uint8Array;
  constructor(buf: Uint8Array) { this.buf = buf; }
  private take(n: number): Uint8Array {
    if (n < 0 || this.pos + n > this.buf.length) throw new Error("borsh: unexpected end of data");
    const out = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
  u8() { return this.take(1)[0]; }
  uint(bytes: number): bigint {
    const b = this.take(bytes);
    let n = 0n;
    for (let i = bytes - 1; i >= 0; i--) n = (n << 8n) | BigInt(b[i]);
    return n;
  }
  u32() { return Number(this.uint(4)); }
  bytes(n: number) { return this.take(n); }
  vec(maxLen = 1 << 20): Uint8Array {
    const n = this.u32();
    if (n > maxLen) throw new Error("borsh: vector too long");
    return this.take(n);
  }
  str(maxLen = 1024): string {
    return new TextDecoder("utf-8", { fatal: true }).decode(this.vec(maxLen));
  }
  get remaining() { return this.buf.length - this.pos; }
}

export function toBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
