import { BUN_SECTION_DATA_HEADER_SIZE, BUN_TRAILER } from "./constants";
import { findBunSection } from "./macho";

export interface DataSection {
  data: DataView;
  container: "macho" | "append";
}

const encoder = new TextEncoder();
const trailerBytes = encoder.encode(BUN_TRAILER);

/**
 * Locate the embedded data section in a Bun-compiled binary.
 *
 * Tries two strategies:
 * 1. Mach-O: look for __BUN/__bun section, skip 8-byte size header, validate trailer at end
 * 2. Appended: check trailer at byteLength - 24, read total_byte_count from last 8 bytes
 *
 * Returns null if neither works.
 */
export function locateDataSection(binary: DataView): DataSection | null {
  // Strategy 1: Mach-O __BUN/__bun section
  const machoSection = findBunSection(binary);
  if (machoSection) {
    const sectionData = new DataView(
      binary.buffer,
      binary.byteOffset + machoSection.offset + BUN_SECTION_DATA_HEADER_SIZE,
      machoSection.size - BUN_SECTION_DATA_HEADER_SIZE,
    );

    if (hasTrailerAt(sectionData, sectionData.byteLength - BUN_TRAILER.length)) {
      return { data: sectionData, container: "macho" };
    }
  }

  // Strategy 2: Appended to file end
  // Layout: [modules][Offsets][trailer 16B][total_byte_count 8B]
  const trailerEnd = binary.byteLength - 8;
  const trailerStart = trailerEnd - BUN_TRAILER.length;
  if (trailerStart >= 0 && hasTrailerAt(binary, trailerStart)) {
    return { data: binary, container: "append" };
  }

  return null;
}

function hasTrailerAt(view: DataView, offset: number): boolean {
  if (offset < 0 || offset + trailerBytes.length > view.byteLength) return false;
  for (let i = 0; i < trailerBytes.length; i++) {
    if (view.getUint8(offset + i) !== trailerBytes[i]) return false;
  }
  return true;
}
