export interface SignedStyleShare {
  token: string;
  url: string;
  pngUrl: string;
}

const SIGNED_TOKEN_PATTERN = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;

export function resolveSignedStyleShareResponse(
  value: unknown,
  baseUrl: string,
  code: string,
): SignedStyleShare | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 2 || !keys.includes("token") || !keys.includes("path")) return null;

  const body = value as Record<string, unknown>;
  if (typeof body.token !== "string" || typeof body.path !== "string") return null;
  if (!SIGNED_TOKEN_PATTERN.test(body.token)) return null;

  const expectedPathname = `/style/${code}/${body.token}`;
  if (body.path !== expectedPathname) return null;

  const normalized = new URL(expectedPathname, baseUrl);
  if (
    normalized.pathname !== expectedPathname
    || normalized.search !== ""
    || normalized.hash !== ""
  ) return null;

  const url = normalized.toString();
  return { token: body.token, url, pngUrl: `${url}/card.png` };
}
