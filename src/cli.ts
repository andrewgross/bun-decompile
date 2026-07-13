#!/usr/bin/env bun
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { extractBundledFiles, getExecutableVersion } from "./lib";

const pkg = require("../package.json");

function printHelp() {
  console.log(`bun-decompile v${pkg.version}

Extracts bundled source files from a Bun-compiled binary.

Usage:
  bun-decompile <input-binary> [options]

Options:
  -o, --output <dir>   Output directory (default: ./decompiled)
  --no-normalize       Don't normalize entrypoint filename to index.js
  -v, --version        Print version and exit
  -h, --help           Print this help and exit`);
}

function parseArgs(args: string[]) {
  let inputPath: string | null = null;
  let outputDir = "./decompiled";
  let noNormalize = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }

    if (arg === "-v" || arg === "--version") {
      console.log(pkg.version);
      process.exit(0);
    }

    if (arg === "--no-normalize") {
      noNormalize = true;
      continue;
    }

    if (arg === "-o" || arg === "--output") {
      const next = args[++i];
      if (!next) {
        console.error("Error: --output requires a directory path");
        process.exit(1);
      }
      outputDir = next;
      continue;
    }

    if (arg.startsWith("-")) {
      console.error(`Error: Unknown option: ${arg}`);
      process.exit(1);
    }

    if (inputPath) {
      console.error("Error: Multiple input files specified");
      process.exit(1);
    }
    inputPath = arg;
  }

  if (!inputPath) {
    printHelp();
    process.exit(1);
  }

  return { inputPath, outputDir, noNormalize };
}

async function main() {
  const { inputPath, outputDir, noNormalize } = parseArgs(process.argv.slice(2));

  const file = Bun.file(inputPath);
  if (!(await file.exists())) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  const data = await file.arrayBuffer();

  // Version detection is informational only — extraction relies on the binary's
  // struct layout, not the version string. Never let a failed/changed version
  // banner (e.g. a future Bun format) block extraction.
  try {
    const version = getExecutableVersion(data);
    const revision = version.revision ? ` (${version.revision})` : "";
    console.log(`Bun v${version.version}${revision}`);
  } catch {
    console.warn("Warning: could not determine the Bun version; continuing with extraction.");
  }

  const files = extractBundledFiles(data, {
    normaliseEntrypointFileName: !noNormalize,
  });

  await mkdir(outputDir, { recursive: true });

  for (const bundledFile of files) {
    const outPath = join(outputDir, bundledFile.path);
    await mkdir(dirname(outPath), { recursive: true });
    await Bun.write(outPath, bundledFile.contents);

    if (bundledFile.sourcemap) {
      await Bun.write(`${outPath}.map`, JSON.stringify(bundledFile.sourcemap));
    }
  }

  console.log(`Extracted ${files.length} file(s) to ${outputDir}`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
