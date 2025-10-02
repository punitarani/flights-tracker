/**
 * A simple ULID-like ID generator.
 * Not fully compliant with the ULID spec, but good enough for our use case.
 */

// Crockford's base32 alphabet (lowercased, no i, l, o, u)
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const TIME_LEN = 10; // timestamp part
const RAND_LEN = 16; // randomness part

function encodeTime(time: number, len: number): string {
  let str = "";
  for (let i = len - 1; i >= 0; i--) {
    const mod = time % 32;
    str = ALPHABET[mod] + str;
    time = Math.floor(time / 32);
  }
  return str;
}

function encodeRandom(len: number): string {
  let str = "";
  for (let i = 0; i < len; i++) {
    const rand = Math.floor(Math.random() * 32);
    str += ALPHABET[rand];
  }
  return str;
}

/**
 * Generate a ULID-like string.
 * Example: "01hcaz7p1x5sphbqkvp8f3z8jv"
 */
export function ulid(): string {
  const now = Date.now();
  return encodeTime(now, TIME_LEN) + encodeRandom(RAND_LEN);
}
