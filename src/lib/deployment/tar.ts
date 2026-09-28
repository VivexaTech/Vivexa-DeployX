import "server-only";
import { gunzipSync } from "node:zlib";

export type ExtractedFile = { path: string; content: Buffer; mode: number };

function readString(buf: Buffer, start: number, length: number): string {
  const slice = buf.subarray(start, start + length);
  const nul = slice.indexOf(0);
  return slice.subarray(0, nul === -1 ? slice.length : nul).toString("utf8");
}

function readOctal(buf: Buffer, start: number, length: number): number {
  const value = readString(buf, start, length).trim();
  return value ? parseInt(value, 8) : 0;
}

function parsePax(content: Buffer): Record<string, string> {
  const result: Record<string, string> = {};
  let offset = 0;
  while (offset < content.length) {
    const space = content.indexOf(0x20, offset);
    if (space === -1) break;
    const length = parseInt(content.subarray(offset, space).toString("utf8"), 10);
    if (!length) break;
    const record = content.subarray(space + 1, offset + length - 1).toString("utf8");
    const eq = record.indexOf("=");
    if (eq > 0) result[record.slice(0, eq)] = record.slice(eq + 1);
    offset += length;
  }
  return result;
}

/**
 * Minimal tar.gz reader for GitHub repository archives. Returns regular files
 * with the archive's top-level directory stripped. Symlinks are skipped.
 */
export function extractTarGz(archive: Buffer): { files: ExtractedFile[]; skipped: number } {
  const tar = gunzipSync(archive);
  const files: ExtractedFile[] = [];
  let skipped = 0;
  let offset = 0;
  let nextPath: string | null = null;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;

    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    const mode = readOctal(header, 100, 8);
    const prefix = readString(header, 345, 155);
    const name = readString(header, 0, 100);
    const dataStart = offset + 512;
    const content = tar.subarray(dataStart, dataStart + size);
    offset = dataStart + Math.ceil(size / 512) * 512;

    if (type === "x") {
      nextPath = parsePax(content).path ?? null;
      continue;
    }
    if (type === "g") continue;
    if (type === "L") {
      nextPath = content.toString("utf8").replace(/\0+$/, "");
      continue;
    }

    const fullPath = nextPath ?? (prefix ? `${prefix}/${name}` : name);
    nextPath = null;

    if (type !== "0" && type !== "\0" && type !== "7") {
      if (type === "2") skipped++;
      continue;
    }

    const relative = fullPath.split("/").slice(1).join("/");
    if (!relative || relative.startsWith(".git/") || relative.includes("..")) continue;
    files.push({ path: relative, content: Buffer.from(content), mode });
  }

  return { files, skipped };
}
