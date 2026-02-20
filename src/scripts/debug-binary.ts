#!/usr/bin/env bun

/**
 * Diagnostic tool for investigating Bun-compiled binary formats.
 *
 * Usage:
 *   bun src/scripts/debug-binary.ts /path/to/binary
 */

import { BUN_TRAILER, BUN_SECTION_DATA_HEADER_SIZE } from "../lib/constants";
import { findBunSection } from "../lib/macho";
import { locateDataSection } from "../lib/formats";
import { parseOffsets } from "../lib/offsets";

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: bun debug-binary.ts <binary>");
    process.exit(1);
  }

  const data = await Bun.file(inputPath).arrayBuffer();
  const view = new DataView(data);
  const decoder = new TextDecoder();

  console.log("=== Binary Info ===");
  console.log(`File: ${inputPath}`);
  console.log(`Size: ${data.byteLength} bytes (${(data.byteLength / 1024 / 1024).toFixed(1)} MB)`);

  // Mach-O detection
  console.log("\n=== Mach-O Detection ===");
  const magic = view.getUint32(0, true);
  console.log(`Magic: 0x${magic.toString(16)} (${magic === 0xfeedfacf ? "Mach-O 64-bit" : "not Mach-O 64-bit"})`);

  const machoSection = findBunSection(view);
  if (machoSection) {
    console.log(`__BUN/__bun section found:`);
    console.log(`  Offset: ${machoSection.offset}`);
    console.log(`  Size: ${machoSection.size} bytes`);

    // Check header
    const headerVal = Number(view.getBigUint64(machoSection.offset, true));
    console.log(`  8B size header value: ${headerVal}`);
    console.log(`  Expected (size - 8): ${machoSection.size - BUN_SECTION_DATA_HEADER_SIZE}`);

    // Check trailer at section end
    const trailerStart = machoSection.offset + machoSection.size - BUN_TRAILER.length;
    const trailer = decoder.decode(new Uint8Array(data, trailerStart, BUN_TRAILER.length));
    console.log(`  Trailer at section end: ${trailer === BUN_TRAILER ? "VALID" : "INVALID"}`);
  } else {
    console.log("No __BUN/__bun section found");
  }

  // Appended format check
  console.log("\n=== Appended Format Check ===");
  const appendTrailerStart = data.byteLength - 8 - BUN_TRAILER.length;
  if (appendTrailerStart > 0) {
    const appendTrailer = decoder.decode(new Uint8Array(data, appendTrailerStart, BUN_TRAILER.length));
    console.log(`Trailer at file end - 24: ${appendTrailer === BUN_TRAILER ? "VALID" : "not found"}`);
    if (appendTrailer === BUN_TRAILER) {
      const totalByteCount = view.getUint32(data.byteLength - 8, true);
      console.log(`Total byte count: ${totalByteCount} (file size: ${data.byteLength}, match: ${totalByteCount === data.byteLength})`);
    }
  }

  // Data section detection
  console.log("\n=== Data Section Detection ===");
  const section = locateDataSection(view);
  if (!section) {
    console.log("FAILED: No data section found");
    return;
  }
  console.log(`Container: ${section.container}`);
  console.log(`Data section size: ${section.data.byteLength} bytes`);

  // Parse offsets
  console.log("\n=== Offsets Struct ===");
  const trailerOffset = section.container === "macho"
    ? section.data.byteLength - BUN_TRAILER.length
    : section.data.byteLength - 8 - BUN_TRAILER.length;

  try {
    const offsets = parseOffsets(section.data, trailerOffset);
    console.log(`Struct size: ${offsets.structSize} bytes`);
    console.log(`offsetByteCount: ${offsets.offsetByteCount}`);
    console.log(`modulesPtrOffset: ${offsets.modulesPtrOffset}`);
    console.log(`modulesPtrLength: ${offsets.modulesPtrLength}`);
    console.log(`entryPointId: ${offsets.entryPointId}`);

    // Detect metadata chunk size
    const candidates = [52, 28, 32];
    for (const cs of candidates) {
      if (offsets.modulesPtrLength % cs === 0) {
        console.log(`Metadata chunk size: ${cs} bytes (${offsets.modulesPtrLength / cs} modules)`);
        break;
      }
    }

    // Hex dump of Offsets area
    const structStart = trailerOffset - offsets.structSize;
    console.log(`\n=== Hex Dump: Offsets Struct (at offset ${structStart}) ===`);
    const structBytes = new Uint8Array(
      section.data.buffer,
      section.data.byteOffset + structStart,
      offsets.structSize,
    );
    const hex = Array.from(structBytes).map(b => b.toString(16).padStart(2, "0")).join(" ");
    console.log(hex);

    // Format version detection
    console.log("\n=== Detected Format ===");
    if (section.container === "macho" && offsets.structSize === 32) {
      console.log("V4 (Bun 1.3.0+): Mach-O + 32-byte Offsets + 52-byte metadata chunks");
    } else if (section.container === "macho" && offsets.structSize === 24) {
      console.log("V3 (Bun 1.2.4-1.2.x): Mach-O + 24-byte Offsets + 28-byte metadata chunks");
    } else if (section.container === "append") {
      // Check new vs old format
      const payloadSize =
        section.data.getUint32(structStart - 20, true) +
        section.data.getUint32(structStart - 16, true);
      if (payloadSize + 1 === offsets.modulesPtrOffset) {
        console.log("V2 (~Bun 1.1.26-1.2.3): Appended + 24-byte Offsets + 28-byte metadata chunks");
      } else {
        console.log("V1 (Bun 0.6.0-~1.1.25): Appended + 24-byte Offsets + 32-byte metadata chunks");
      }
    }
  } catch (e: any) {
    console.log(`Failed to parse offsets: ${e.message}`);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
