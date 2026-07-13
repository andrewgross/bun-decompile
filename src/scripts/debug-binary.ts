#!/usr/bin/env bun

/**
 * Diagnostic tool for investigating Bun-compiled binary formats.
 *
 * Usage:
 *   bun src/scripts/debug-binary.ts /path/to/binary
 */
import { BUN_TRAILER } from "../lib/constants";
import { detectExecutableFormat, findBunSectionOffset, locateBunSection } from "../lib/formats";
import { getExecutableVersion } from "../lib/index";
import { buildModuleGraph } from "../lib/modules";
import { parseOffsets } from "../lib/offsets";

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: bun debug-binary.ts <binary>");
    process.exit(1);
  }

  const data = await Bun.file(inputPath).arrayBuffer();
  const binary = new DataView(data);

  console.log("=== Binary Info ===");
  console.log(`File: ${inputPath}`);
  console.log(`Size: ${data.byteLength} bytes (${(data.byteLength / 1024 / 1024).toFixed(1)} MB)`);

  console.log("\n=== Executable Format ===");
  const format = detectExecutableFormat(binary);
  console.log(`Detected: ${format}`);
  const sectionOffset = findBunSectionOffset(binary);
  console.log(`__BUN/.bun section offset: ${sectionOffset ?? "(none — appended or absent)"}`);

  console.log("\n=== Bun Version ===");
  try {
    const v = getExecutableVersion(data);
    console.log(`${v.version}${v.revision ? ` (${v.revision})` : ""}`);
  } catch (e: any) {
    console.log(`Not found: ${e.message}`);
  }

  console.log("\n=== Data Section ===");
  let section;
  try {
    section = locateBunSection(binary);
    console.log(`Container: ${section.container}`);
    console.log(`Payload size (ends at trailer): ${section.view.byteLength} bytes`);
  } catch (e: any) {
    console.log(`FAILED: ${e.message}`);
    return;
  }

  console.log("\n=== Offsets Struct ===");
  const trailerOffset = section.view.byteLength - BUN_TRAILER.length;
  let offsets;
  try {
    offsets = parseOffsets(section.view, trailerOffset);
  } catch (e: any) {
    console.log(`FAILED: ${e.message}`);
    return;
  }
  console.log(`structSize: ${offsets.structSize}`);
  console.log(`offsetByteCount: ${offsets.offsetByteCount}`);
  console.log(`modulesPtrOffset: ${offsets.modulesPtrOffset}`);
  console.log(`modulesPtrLength: ${offsets.modulesPtrLength}`);
  console.log(`entryPointId: ${offsets.entryPointId}`);

  const structStart = trailerOffset - offsets.structSize;
  const structBytes = new Uint8Array(
    section.view.buffer,
    section.view.byteOffset + structStart,
    offsets.structSize,
  );
  console.log(`hex: ${Array.from(structBytes, (b) => b.toString(16).padStart(2, "0")).join(" ")}`);

  console.log("\n=== Module Graph ===");
  try {
    const graph = buildModuleGraph(section, offsets);
    console.log(`Container: ${section.container}`);
    console.log(`chunkSize: ${graph.format.chunkSize} (${graph.moduleCount} modules)`);
    console.log(
      `newFormat: ${graph.format.newFormat}, absoluteOffsets: ${graph.format.hasAbsoluteOffsets}`,
    );
    console.log(`modulesStart: ${graph.modulesStart}`);
  } catch (e: any) {
    console.log(`FAILED: ${e.message}`);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
