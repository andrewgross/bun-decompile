import { LC_SEGMENT_64, MACHO_MAGIC_64_LE } from "./constants";

export interface MachoSection {
  offset: number;
  size: number;
}

/**
 * Find the __BUN/__bun section in a Mach-O 64-bit binary.
 * Returns the file offset and size, or null if not a Mach-O or section not found.
 */
export function findBunSection(binary: DataView): MachoSection | null {
  if (binary.byteLength < 32) return null;

  const magic = binary.getUint32(0, true);
  if (magic !== MACHO_MAGIC_64_LE) return null;

  // Mach-O 64-bit header:
  //   0: magic (4)
  //   4: cputype (4)
  //   8: cpusubtype (4)
  //  12: filetype (4)
  //  16: ncmds (4)
  //  20: sizeofcmds (4)
  //  24: flags (4)
  //  28: reserved (4)
  // Total: 32 bytes
  const ncmds = binary.getUint32(16, true);
  const sizeofcmds = binary.getUint32(20, true);
  const headerSize = 32;

  if (binary.byteLength < headerSize + sizeofcmds) return null;

  let offset = headerSize;
  const decoder = new TextDecoder();

  for (let i = 0; i < ncmds; i++) {
    if (offset + 8 > binary.byteLength) break;

    const cmd = binary.getUint32(offset, true);
    const cmdsize = binary.getUint32(offset + 4, true);

    if (cmdsize < 8 || offset + cmdsize > binary.byteLength) break;

    if (cmd === LC_SEGMENT_64) {
      // LC_SEGMENT_64 layout:
      //   0: cmd (4)
      //   4: cmdsize (4)
      //   8: segname (16)
      //  24: vmaddr (8)
      //  32: vmsize (8)
      //  40: fileoff (8)
      //  48: filesize (8)
      //  56: maxprot (4)
      //  60: initprot (4)
      //  64: nsects (4)
      //  68: flags (4)
      // Total: 72 bytes
      const segname = readNullTerminated(binary, offset + 8, 16, decoder);

      if (segname === "__BUN") {
        const nsects = binary.getUint32(offset + 64, true);
        let sectOffset = offset + 72;

        for (let j = 0; j < nsects; j++) {
          // Section 64 layout:
          //   0: sectname (16)
          //  16: segname (16)
          //  32: addr (8)
          //  40: size (8)
          //  48: offset (4)
          //  52: align (4)
          //  56: reloff (4)
          //  60: nreloc (4)
          //  64: flags (4)
          //  68: reserved1 (4)
          //  72: reserved2 (4)
          //  76: reserved3 (4)
          // Total: 80 bytes
          if (sectOffset + 80 > binary.byteLength) break;

          const sectname = readNullTerminated(binary, sectOffset, 16, decoder);

          if (sectname === "__bun") {
            // size is at sectOffset + 40, 8 bytes (u64)
            // offset is at sectOffset + 48, 4 bytes (u32)
            const size = Number(binary.getBigUint64(sectOffset + 40, true));
            const fileOffset = binary.getUint32(sectOffset + 48, true);

            return { offset: fileOffset, size };
          }

          sectOffset += 80;
        }
      }
    }

    offset += cmdsize;
  }

  return null;
}

function readNullTerminated(
  view: DataView,
  offset: number,
  maxLen: number,
  decoder: TextDecoder,
): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, maxLen);
  const nullIdx = bytes.indexOf(0);
  const len = nullIdx === -1 ? maxLen : nullIdx;
  return decoder.decode(bytes.subarray(0, len));
}
