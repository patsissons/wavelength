export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyToken(
  tokens: Record<string, string>,
  playerId: string | null,
  token: string | null,
): Promise<boolean> {
  if (!playerId || !token) return false;
  const expected = tokens[playerId];
  if (!expected) return false;
  return (await sha256Hex(token)) === expected;
}
