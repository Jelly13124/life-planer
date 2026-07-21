import { createClient } from "@supabase/supabase-js";

const NO_STORE_HEADERS = { "cache-control": "no-store" } as const;
const MAX_BEARER_TOKEN_LENGTH = 8192;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE_HEADERS });
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token || token.length > MAX_BEARER_TOKEN_LENGTH) return null;
  return token;
}

export async function DELETE(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return jsonError("Unauthorized", 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const adminKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !publishableKey || !adminKey) {
    return jsonError("Account deletion is temporarily unavailable", 503);
  }

  try {
    const authClient = createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !user) return jsonError("Unauthorized", 401);

    const adminClient = createClient(url, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) return jsonError("Unable to delete account", 502);
  } catch {
    return jsonError("Unable to delete account", 502);
  }

  return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
}
