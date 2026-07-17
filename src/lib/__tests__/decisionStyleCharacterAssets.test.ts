import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allDecisionPersonalityPresentations } from "@/domain/decisionStyle";

const roots = [
  join(process.cwd(), "public", "decision-style", "characters"),
  join(process.cwd(), "mobile", "assets", "decision-style", "characters"),
];

function pngInfo(buffer: Buffer) {
  return {
    signature: buffer.subarray(0, 8).toString("hex"),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
    hash: createHash("sha256").update(buffer).digest("hex"),
  };
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
      expect(mobile.hash).toBe(web.hash);
    }
  });
});
