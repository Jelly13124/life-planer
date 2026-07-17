import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { allDecisionPersonalityPresentations } from "@/domain/decisionStyle";

const roots = [
  join(process.cwd(), "public", "decision-style", "characters"),
  join(process.cwd(), "mobile", "assets", "decision-style", "characters"),
];

function pngInfo(buffer: Buffer) {
  const idatChunks: Buffer[] = [];
  let offset = 8;

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (type === "IDAT") {
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    }

    offset = dataEnd + 4;
  }

  return {
    signature: buffer.subarray(0, 8).toString("hex"),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
    compressionMethod: buffer[26],
    filterMethod: buffer[27],
    interlaceMethod: buffer[28],
    imageData: Buffer.concat(idatChunks),
    hash: createHash("sha256").update(buffer).digest("hex"),
  };
}

function paethPredictor(left: number, above: number, upperLeft: number) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function hasTransparentBorder(png: ReturnType<typeof pngInfo>) {
  const channels = png.colorType === 6 ? 4 : 2;
  const bytesPerPixel = channels;
  const rowLength = png.width * bytesPerPixel;
  const scanlines = inflateSync(png.imageData);
  let previousRow = Buffer.alloc(rowLength);
  let offset = 0;

  for (let y = 0; y < png.height; y += 1) {
    const filter = scanlines[offset];
    offset += 1;
    const filtered = scanlines.subarray(offset, offset + rowLength);
    offset += rowLength;
    const row = Buffer.alloc(rowLength);

    for (let x = 0; x < rowLength; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const above = previousRow[x];
      const upperLeft = x >= bytesPerPixel ? previousRow[x - bytesPerPixel] : 0;

      if (filter === 0) row[x] = filtered[x];
      else if (filter === 1) row[x] = (filtered[x] + left) & 0xff;
      else if (filter === 2) row[x] = (filtered[x] + above) & 0xff;
      else if (filter === 3) row[x] = (filtered[x] + Math.floor((left + above) / 2)) & 0xff;
      else if (filter === 4) row[x] = (filtered[x] + paethPredictor(left, above, upperLeft)) & 0xff;
      else throw new Error(`Unsupported PNG filter: ${filter}`);
    }

    const alphaOffset = channels - 1;
    if (row[alphaOffset] !== 0 || row[rowLength - bytesPerPixel + alphaOffset] !== 0) return false;
    if (y === 0 || y === png.height - 1) {
      for (let x = alphaOffset; x < rowLength; x += bytesPerPixel) {
        if (row[x] !== 0) return false;
      }
    }

    previousRow = row;
  }

  return offset === scanlines.length;
}

describe("decision personality character assets", () => {
  it("ships matching square transparent PNGs for all 16 codes", async () => {
    for (const item of allDecisionPersonalityPresentations()) {
      const copies = await Promise.all(roots.map((root) => readFile(join(root, `${item.characterId}.png`))));
      const [web, mobile] = copies.map(pngInfo);
      expect(web.signature).toBe("89504e470d0a1a0a");
      expect(web.width).toBe(web.height);
      expect(web.width).toBeGreaterThanOrEqual(1024);
      expect([4, 6]).toContain(web.colorType);
      expect(web.bitDepth).toBe(8);
      expect(web.compressionMethod).toBe(0);
      expect(web.filterMethod).toBe(0);
      expect(web.interlaceMethod).toBe(0);
      expect(hasTransparentBorder(web)).toBe(true);
      expect(mobile.hash).toBe(web.hash);
    }
  }, 15_000);
});
