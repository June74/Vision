/** Verifies server-bound CSRF tokens for session-authenticated state changes. */

const encoder = new TextEncoder();
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;

/** Compares a supplied CSRF token to the decrypted server value through fixed-length SHA-256 digests. */
export async function verifyCsrfToken(
  supplied: string | null,
  expected: string,
): Promise<boolean> {
  const safeSupplied = supplied && TOKEN_PATTERN.test(supplied) ? supplied : "";
  const safeExpected = TOKEN_PATTERN.test(expected) ? expected : "";
  const [suppliedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(safeSupplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(safeExpected)),
  ]);
  const suppliedBytes = new Uint8Array(suppliedDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = safeSupplied.length === 0 || safeExpected.length === 0 ? 1 : 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= suppliedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}
