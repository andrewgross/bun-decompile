export interface ParsedOffsets {
  offsetByteCount: number;
  modulesPtrOffset: number;
  modulesPtrLength: number;
  entryPointId: number;
  structSize: number; // 24 or 32
}

/**
 * Parse the Offsets struct from the end of a data section (right before the trailer).
 *
 * Real Bun `Offsets` extern struct (little-endian), from structStart:
 *   [0-7]:   byte_count (u64)          — total modules+metadata size (we read the low u32)
 *   [8-11]:  modules_ptr.offset (u32)  — offset to metadata within the modules area
 *   [12-15]: modules_ptr.length (u32)  — total length of metadata entries
 *   [16-19]: entry_point_id (u32)      — index of the entry module
 *   [20-27]: compile_exec_argv_ptr     — V4 only (32-byte struct)
 *   [28-31]: flags                     — V4 only
 *
 * V2/V3 stop after entry_point_id (padded to 24 bytes); V4 adds the last two
 * fields (32 bytes). Probes 32 bytes first, then 24, checking validity.
 *
 * NOTE: entry_point_id lives at +16 (after the u64 byte_count), not +4. Reading
 * it at +4 — the high dword of byte_count — yields 0 for any <4GB binary, which
 * only happens to be correct because the entry point is usually module 0.
 */
export function parseOffsets(view: DataView, trailerOffset: number): ParsedOffsets {
  for (const structSize of [32, 24]) {
    const result = tryParseOffsetsAt(view, trailerOffset, structSize);
    if (result) return result;
  }

  throw new Error("Could not parse Offsets struct: no valid struct size found");
}

function tryParseOffsetsAt(
  view: DataView,
  trailerOffset: number,
  structSize: number,
): ParsedOffsets | null {
  const structStart = trailerOffset - structSize;
  if (structStart < 0) return null;

  const offsetByteCount = view.getUint32(structStart, true);
  const modulesPtrOffset = view.getUint32(structStart + 8, true);
  const modulesPtrLength = view.getUint32(structStart + 12, true);
  const entryPointId = view.getUint32(structStart + 16, true);

  // Validity checks
  if (offsetByteCount > structStart) return null;
  if (modulesPtrOffset > offsetByteCount) return null;
  if (modulesPtrLength === 0 || modulesPtrLength > offsetByteCount) return null;
  if (entryPointId > 10000) return null;

  return {
    offsetByteCount,
    modulesPtrOffset,
    modulesPtrLength,
    entryPointId,
    structSize,
  };
}
