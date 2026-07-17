export interface SignedStyleShare {
  token: string;
  url: string;
  pngUrl: string;
}

export function resolveSignedStyleShareResponse(
  value: unknown,
  baseUrl: string,
  code: string,
): SignedStyleShare | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.token !== "string" || typeof body.path !== "string") return null;
  if (body.path !== `/style/${code}/${body.token}`) return null;

  const url = new URL(body.path, baseUrl).toString();
  return { token: body.token, url, pngUrl: `${url}/card.png` };
}
