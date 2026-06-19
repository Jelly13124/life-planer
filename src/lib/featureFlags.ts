// 云端存档默认关（走 localStorage）。开启需 NEXT_PUBLIC_USE_SUPABASE=1 + 配好密钥（见 docs/supabase-setup.md）。
export function useSupabaseCloud(): boolean {
  return process.env.NEXT_PUBLIC_USE_SUPABASE === "1";
}
