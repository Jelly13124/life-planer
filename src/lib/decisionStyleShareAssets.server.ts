import { readFile } from "node:fs/promises";
import { join } from "node:path";
import qrcode from "qrcode-generator";
import { decisionPersonalityPresentationByCode } from "@/domain/decisionStyle";

const CHARACTER_FALLBACK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="240" fill="#FBE4D5"/><circle cx="512" cy="390" r="150" fill="#C2410C"/><path d="M252 862c28-190 134-286 260-286s232 96 260 286" fill="#2D2925"/></svg>';

export async function loadDecisionStyleCharacterDataUrl(code: string): Promise<string> {
  const item = decisionPersonalityPresentationByCode(code);
  if (!item) throw new Error("Unknown decision personality code");

  try {
    const data = await readFile(
      join(
        process.cwd(),
        "public",
        "decision-style",
        "characters",
        `${item.characterId}.png`,
      ),
    );
    return `data:image/png;base64,${data.toString("base64")}`;
  } catch {
    return `data:image/svg+xml;base64,${Buffer.from(CHARACTER_FALLBACK_SVG, "utf8").toString("base64")}`;
  }
}

export function decisionStyleQrDataUrl(url: string): string {
  const qr = qrcode(0, "M");
  qr.addData(url, "Byte");
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 6, margin: 12, scalable: true });
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
