/**
 * The location of the embedded Bun payload within a host executable — the file
 * offset and exact byte length of the `__BUN`/`.bun` section. The section data
 * ends exactly at the Bun trailer (`locateBunSection` asserts this).
 */
export interface SectionLocation {
  offset: number;
  size: number;
}

/**
 * Read a NUL-terminated ASCII string of at most `maxLen` bytes starting at
 * `offset`. Used for section/segment names in Mach-O, ELF, and PE headers.
 */
export function readCString(view: DataView, offset: number, maxLen: number): string {
  if (offset < 0 || offset >= view.byteLength) return "";
  const len = Math.min(maxLen, view.byteLength - offset);
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, len);
  const nul = bytes.indexOf(0);
  return new TextDecoder().decode(nul === -1 ? bytes : bytes.subarray(0, nul));
}
