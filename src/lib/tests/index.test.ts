import type { BunFile } from "bun";

import { readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { beforeAll, beforeEach, describe, expect, test } from "bun:test";

import {
  extractBundledFiles,
  getExecutableVersion,
  InvalidExecutableError,
  InvalidTrailerError,
  TotalByteCountMismatchError,
} from "..";

let dummy: BunFile;
let dummyData: ArrayBuffer;

let notAnExecutable: ArrayBuffer;

const expectedVersion = process.env.DUMMY_VERSION;

if (!expectedVersion) {
  throw new Error("$DUMMY_VERSION is not set");
}

beforeAll(async () => {
  // Get a reference to the dummy executable file
  dummy = Bun.file("src/lib/tests/dummy/dummy");

  // Generate some binary data which is not a Bun-compiled executable
  notAnExecutable = new ArrayBuffer(8);
  const view = new DataView(notAnExecutable);
  view.setUint32(0, 0xdeadbeef, true);
  view.setUint32(4, 0xdeadbeef, true);
});

beforeEach(async () => {
  // Re-read the executable data from the file before each test
  dummyData = await dummy.arrayBuffer();
});

describe("extractBundledFiles", () => {
  test("with dummy executable", () => {
    const bundledFiles = extractBundledFiles(dummyData);

    // There should be exactly four bundled files
    expect(bundledFiles).toHaveLength(4);

    // All file paths should not have slashes
    for (const bundledFile of bundledFiles) {
      expect(bundledFile.path).not.toInclude("/");
    }

    // The first file should be the entrypoint
    expect(bundledFiles[0].path).toBe("index.js");

    // After that, the rest of the files will be in an unknown order
    // so we'll sort them by path to make the test deterministic
    const restSorted = bundledFiles.slice(1).sort((a, b) => a.path.localeCompare(b.path));
    expect(restSorted[0].path).toMatch(/^fakeversion.*\.bin$/);
    expect(restSorted[1].path).toMatch(/^favicon.*\.png$/);
    expect(restSorted[2].path).toMatch(/^password2.*\.bin$/);
  });

  test("with a non-executable", () => {
    expect(() => extractBundledFiles(notAnExecutable)).toThrowError(InvalidTrailerError);
  });

  test("with a corrupt executable", () => {
    // Corrupt the binary so neither Mach-O nor appended format can find valid data
    const corrupted = dummyData.slice(0);
    const view = new DataView(corrupted);

    // Corrupt the Mach-O magic (first 4 bytes) to prevent Mach-O section detection
    view.setUint32(0, 0xdeadbeef, true);

    // The appended format check will also fail since the file end doesn't have a valid trailer

    expect(() => extractBundledFiles(corrupted)).toThrowError(InvalidTrailerError);
  });
});

describe("getExecutableVersion", () => {
  test("with dummy executable", () => {
    const version = getExecutableVersion(dummyData);

    // The version of Bun in the executable should be the same as the current runtime,
    // as we call Bun build earlier with this same instance of Bun (supposedly)

    // Use a RegEx to allow for canary versions (eg. 1.1.22-canary.96)
    expect(version.version).toMatch(new RegExp(`^${expectedVersion}(-.+)?$`));
  });

  test("with current runtime", async () => {
    expect(process.execPath).toBeString();

    const runtimeExecutable = Bun.file(process.execPath);
    const runtimeExecutableData = await runtimeExecutable.arrayBuffer();

    const version = getExecutableVersion(runtimeExecutableData);

    // The versions should be equal as we are comparing to the current runtime
    expect(version.version).toMatch(new RegExp(`^${Bun.version}(-.+)?$`));
  });

  test("with a non-executable", () => {
    expect(() => getExecutableVersion(notAnExecutable)).toThrowError(InvalidExecutableError);
  });

  test("with Bun 1.4.0+ banner-only format", () => {
    // Bun 1.4.0+ compiled binaries no longer embed a literal version after the
    // ANSI "bun build v" marker (it's a runtime-substituted placeholder); only
    // the "Bun v<version> (<sha>)" banner remains. Synthesize that layout: a
    // 512-byte buffer whose trailing offsetByteCount is 0 (so the legacy search
    // limit stays wide) with the banner near the start.
    const buf = new Uint8Array(512);
    buf.set(new TextEncoder().encode("Bun v1.4.0 (63bb0ca0d)"), 64);

    const version = getExecutableVersion(buf.buffer);
    expect(version.version).toBe("1.4.0");
    expect(version.revision).toBe("63bb0ca0d");
  });
});

describe("multi-version fixtures", () => {
  const fixturesDir = join(import.meta.dir, "fixtures");
  let fixtures: string[] = [];

  try {
    fixtures = readdirSync(fixturesDir)
      .filter((f) => f.startsWith("v") && f.endsWith(".bin"))
      .map((f) => join(fixturesDir, f));
  } catch {
    // fixtures directory may not exist yet
  }

  if (fixtures.length === 0) {
    test.skip("no fixtures found (run `bun run build-fixtures` first)", () => {});
  } else {
    for (const fixturePath of fixtures) {
      test(`parses ${basename(fixturePath)}`, async () => {
        const data = await Bun.file(fixturePath).arrayBuffer();
        const files = extractBundledFiles(data);
        expect(files.length).toBeGreaterThan(0);
        expect(files[0].path).toBe("index.js");
      });
    }
  }
});
