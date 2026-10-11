/** No vowels (no accidental words) and no I/O/U (easy to misread). */
const ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";
export const CODE_LENGTH = 4;

export function generateCode(random: () => number): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return code;
}

/** Uppercase and strip anything that is not a code letter. */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .split("")
    .filter((ch) => ALPHABET.includes(ch))
    .join("")
    .slice(0, CODE_LENGTH);
}

export function isValidCode(input: string): boolean {
  return input.length === CODE_LENGTH && normalizeCode(input) === input;
}
