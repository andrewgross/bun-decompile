#!/usr/bin/env bun

/**
 * Extracts just the data section from a Bun-compiled binary.
 *
 * For Mach-O binaries: extracts the __BUN/__bun section content (minus the 8-byte size header).
 * For appended binaries: extracts the modules+offsets+trailer area (without total_byte_count).
 *
 * Output is a normalized blob: [modules][Offsets][trailer]
 *
 * Usage:
 *   bun src/scripts/extract-section.ts <binary> -o <output.bin>
 */

import { BUN_SECTION_DATA_HEADER_SIZE, BUN_TRAILER } from "../lib/constants";
import { findBunSection } from "../lib/macho";

function parseArgs(args: string[]) {
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-o" || args[i] === "--output") {
      outputPath = args[++i];
    } else if (!args[i].startsWith("-")) {
      inputPath = args[i];
    }
  }

  if (!inputPath || !outputPath) {
    console.error("Usage: bun extract-section.ts <binary> -o <output.bin>");
    process.exit(1);
  }

  return { inputPath, outputPath };
}

async function main() {
  const { inputPath, outputPath } = parseArgs(process.argv.slice(2));

  const data = await Bun.file(inputPath).arrayBuffer();
  const view = new DataView(data);

  const machoSection = findBunSection(view);

  let sectionData: ArrayBuffer;

  if (machoSection) {
    // Mach-O: skip the 8-byte size header, extract rest of section
    sectionData = data.slice(
      machoSection.offset + BUN_SECTION_DATA_HEADER_SIZE,
      machoSection.offset + machoSection.size,
    );
    console.log(`Mach-O __BUN/__bun section: offset=${machoSection.offset}, size=${machoSection.size}`);
    console.log(`Extracted ${sectionData.byteLength} bytes (after skipping ${BUN_SECTION_DATA_HEADER_SIZE}B header)`);
  } else {
    // Appended: extract from modulesStart to end - 8 (strip total_byte_count)
    const encoder = new TextEncoder();
    const trailerBytes = encoder.encode(BUN_TRAILER);
    const trailerStart = data.byteLength - 8 - trailerBytes.length;

    // Verify trailer
    const trailerCheck = new Uint8Array(data, trailerStart, trailerBytes.length);
    let trailerValid = true;
    for (let i = 0; i < trailerBytes.length; i++) {
      if (trailerCheck[i] !== trailerBytes[i]) {
        trailerValid = false;
        break;
      }
    }
    if (!trailerValid) {
      console.error("Error: No valid Bun data section found in binary");
      process.exit(1);
    }

    // Find modules start using the Offsets struct
    const offsetByteCount = view.getUint32(data.byteLength - 48, true);
    const modulesStart = data.byteLength - (offsetByteCount + 48);

    // Extract: [modules][Offsets][trailer] without total_byte_count
    sectionData = data.slice(modulesStart, data.byteLength - 8);
    console.log(`Appended format: modulesStart=${modulesStart}`);
    console.log(`Extracted ${sectionData.byteLength} bytes`);
  }

  await Bun.write(outputPath, sectionData);
  console.log(`Written to ${outputPath}`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
