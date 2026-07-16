#!/usr/bin/env bun

/**
 * Extracts just the Bun payload from a compiled binary as a small, self-contained
 * blob suitable for a fast unit-test fixture.
 *
 * Output layout: [modules][metadata][Offsets][trailer][totalByteCount 8B] — i.e.
 * a legacy "appended" blob with no host-executable wrapper, so it can be fed
 * straight back into extractBundledFiles.
 *
 * Every format round-trips: a container-stripped V3 payload (Bun 1.2.4, 24-byte
 * Offsets) is exactly what Bun itself emits for a 1.2.4 Linux/Windows target, so
 * resolveModuleFormat identifies it from the metadata rather than the container.
 *
 * Usage:
 *   bun src/scripts/extract-section.ts <binary> -o <output.bin>
 */
import { BUN_TRAILER } from "../lib/constants";
import { locateBunSection } from "../lib/formats";
import { buildModuleGraph } from "../lib/modules";
import { parseOffsets } from "../lib/offsets";

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
  const binary = new DataView(data);

  const section = locateBunSection(binary);
  const offsets = parseOffsets(section.view, section.view.byteLength - BUN_TRAILER.length);
  const graph = buildModuleGraph(section, offsets);

  // Payload region ending at the trailer: [modules][metadata][Offsets][trailer].
  const payload = new Uint8Array(
    section.view.buffer.slice(
      section.view.byteOffset + graph.modulesStart,
      section.view.byteOffset + section.view.byteLength,
    ),
  );

  // Re-emit as a self-contained appended blob (payload + 8-byte total count).
  const out = new Uint8Array(payload.length + 8);
  out.set(payload, 0);
  new DataView(out.buffer).setUint32(payload.length, out.length, true);

  await Bun.write(outputPath, out);
  console.log(`Container: ${section.container}; extracted ${out.length} bytes to ${outputPath}`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
