export const BUNFS_ROOT = "/$bunfs/root";
export const BUNFS_ROOT_OLD = "compiled://root";
// Windows mounts the virtual FS on a drive, e.g. "B:/~BUN/root" (the drive
// letter may vary), with forward or back slashes.
export const BUNFS_ROOT_WINDOWS = /^[A-Za-z]:[/\\]~BUN[/\\]root/;

export const BUN_TRAILER = "\n---- Bun! ----\n";

export const BUN_VERSION_MATCH = "\x1b[0m\x1b[1mbun build \x1b[0m\x1b[2mv";
export const BUN_VERSION_MATCH_OLD = "----- bun meta -----\nBun v";
// Bun 1.4.0+ no longer embeds a literal version after BUN_VERSION_MATCH (it
// became a runtime-substituted placeholder); the plain "Bun v" banner remains.
export const BUN_VERSION_MATCH_BANNER = "Bun v";

export const MACHO_MAGIC_64_LE = 0xfeedfacf;
export const LC_SEGMENT_64 = 0x19;
// ELF magic "\x7fELF" read as a little-endian u32.
export const ELF_MAGIC_LE = 0x464c457f;
