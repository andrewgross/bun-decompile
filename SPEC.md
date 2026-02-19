# Spec: Convert bun-decompile from Web App to CLI Tool

## Goal

Strip the SvelteKit web app and make bun-decompile a publishable CLI tool that extracts files to disk.

The core decompilation logic in `src/lib/index.ts` is already pure functions with no UI dependencies — it stays as-is.

## Branch

`cli-tool` (already created)

---

## Steps

### 1. Create CLI entry point — `src/cli.ts`

- Shebang: `#!/usr/bin/env bun`
- Args:
  - `<input-binary>` — required, path to compiled Bun binary
  - `-o, --output <dir>` — output directory (default: `./decompiled`)
  - `--no-normalize` — skip normalizing entrypoint filename to `index.js`
  - `-v, --version` — print version from package.json, exit
  - `-h, --help` — print usage, exit
- Logic:
  1. Read binary via `Bun.file(path).arrayBuffer()`
  2. Call `getExecutableVersion()` from `src/lib/index.ts`
  3. Call `extractBundledFiles()` with normalize option
  4. For each `BundledFile`: `mkdir -p` the parent dir, write contents
  5. If `bundledFile.sourcemap` exists, write `<path>.map` alongside it
  6. Print summary: Bun version, file count, output path

### 2. Update `package.json`

- Remove `"private": true`
- Add `"bin": { "bun-decompile": "./src/cli.ts" }`
- Add `"files": ["src/lib/", "src/cli.ts"]`
- Remove web-only devDependencies:
  - `@sveltejs/adapter-static`, `@sveltejs/kit`, `@sveltejs/vite-plugin-svelte`
  - `svelte`, `svelte-check`, `svelte-highlight`
  - `vite`, `sass`
  - `jszip`, `@luisafk/minifs`, `@sgtpooki/file-type`, `lucide-svelte`
  - `prettier-plugin-svelte`
  - `svgo`
- Keep: `@types/bun`, `typescript`, `prettier`, `@ianvs/prettier-plugin-sort-imports`, `tslib`
- Remove `"trustedDependencies"` (all were web-related)
- Scripts — remove: `dev`, `build`, `preview`, `check`, `check:watch`, `optimise-svg`
- Scripts — keep: `tests`, `lint`, `format`
- Scripts — add: `"start": "bun src/cli.ts"`

### 3. Delete web app files

- `src/routes/` — `+page.svelte`, `+layout.ts`
- `src/lib/components/` — all `.svelte` files
- `src/app.html`
- `src/app.d.ts`
- `svelte.config.js`
- `vite.config.ts`
- `static/favicon.svg`
- `.github/workflows/deploy.yml`

**Keep:**
- `static/favicon.png` — the test dummy (`src/lib/tests/dummy/index.ts`) imports it
- `static/Bun.tcl` — Hex Fiend template, unrelated to web app

### 4. Update `.prettierrc.json`

- Remove `prettier-plugin-svelte` from plugins
- Remove svelte overrides
- Remove svelte-related import order entries (`^svelte$`, `^svelte/`, `^@sveltejs/`)

### 5. Update `tsconfig.json`

- Remove `"extends": "./.svelte-kit/tsconfig.json"`
- Remove SvelteKit comments
- Remove `.svelte-kit`-relative excludes (`../node_modules/**`, service-worker entries)
- Add `"module": "esnext"`, `"target": "esnext"`, `"types": ["bun-types"]`
- Add `"include": ["src/**/*.ts"]`
- Simplify excludes to `["node_modules", "src/lib/tests/**"]`

### 6. Update `README.md`

- Remove badges, screenshot, web app references
- Add CLI installation (`bun add -g bun-decompile`, `bunx bun-decompile`)
- Document flags and example usage
- Brief note on library usage via `import from "bun-decompile/src/lib"`

### 7. Run `bun install` and verify

- `bun install` — deps install cleanly
- `bun test` — requires building dummy first (see test script), but core lib has no changes so tests should pass
- `bun src/cli.ts --help` — shows usage
- Manual smoke test:
  ```sh
  bun build --compile --sourcemap=inline src/lib/tests/dummy/index.ts --outfile /tmp/dummy
  bun src/cli.ts /tmp/dummy -o /tmp/decompiled
  ls /tmp/decompiled/
  ```

---

## Files unchanged

- `src/lib/index.ts` — core decompilation logic, no changes needed
- `src/lib/constants.ts` — no changes needed
- `src/lib/tests/` — test files stay as-is
- `src/scripts/` — build/test scripts stay as-is
- `static/Bun.tcl` — keep
- `static/favicon.png` — keep (test dependency)
