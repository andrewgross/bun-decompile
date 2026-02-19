# bun-decompile

Extracts the original transpiled sources from an executable file generated via `bun build --compile`.

## Installation

```sh
bun add -g bun-decompile
```

Or run directly with `bunx`:

```sh
bunx bun-decompile <binary>
```

## Usage

```sh
bun-decompile <input-binary> [options]
```

### Options

| Flag | Description |
|---|---|
| `-o, --output <dir>` | Output directory (default: `./decompiled`) |
| `--no-normalize` | Don't normalize entrypoint filename to `index.js` |
| `-v, --version` | Print version and exit |
| `-h, --help` | Print help and exit |

### Examples

Extract files from a compiled binary:

```sh
bun-decompile ./my-app -o ./extracted
```

Extract without normalizing the entrypoint filename:

```sh
bun-decompile ./my-app --no-normalize
```

## Library Usage

You can also import the core functions directly:

```ts
import { extractBundledFiles, getExecutableVersion } from "bun-decompile/src/lib";
```
