export const BUNFS_ROOT = "/$bunfs/root";
export const BUNFS_ROOT_OLD = "compiled://root";

export const BUN_TRAILER = "\n---- Bun! ----\n";

export const BUN_VERSION_MATCH = "\x1b[0m\x1b[1mbun build \x1b[0m\x1b[2mv";
export const BUN_VERSION_MATCH_OLD = "----- bun meta -----\nBun v";
// Bun 1.4.0+ no longer embeds a literal version after BUN_VERSION_MATCH (it
// became a runtime-substituted placeholder); the plain "Bun v" banner remains.
export const BUN_VERSION_MATCH_BANNER = "Bun v";

export const MACHO_MAGIC_64_LE = 0xfeedfacf;
export const LC_SEGMENT_64 = 0x19;
export const BUN_SECTION_DATA_HEADER_SIZE = 8;
