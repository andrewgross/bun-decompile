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
 * Struct layout (from structStart):
 *   [0-3]:  offsetByteCount (u32) — total size of modules + metadata
 *   [4-7]:  entryPointId (u32)
 *   [8-11]: modulesPtrOffset (u32) — offset to metadata within modules area
 *   [12-15]: modulesPtrLength (u32) — total length of metadata entries
 *   [16-23]: other fields (V2/V3 — 24 bytes total)
 *   [16-31]: other fields (V4 — 32 bytes total, includes compile_exec_argv_ptr + flags)
 *
 * Probes 32 bytes first (V4), then 24 bytes (V2/V3), checking validity constraints.
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
  const entryPointId = view.getUint32(structStart + 4, true);
  const modulesPtrOffset = view.getUint32(structStart + 8, true);
  const modulesPtrLength = view.getUint32(structStart + 12, true);

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
