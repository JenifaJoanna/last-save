/** A deliberate, user-readable refusal: the host CLI stops and explains why instead of serving something unverified. */
export class Refusal extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
