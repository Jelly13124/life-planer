// 云端存档默认关（走 localStorage）。开启 = 同时配好两个公开环境变量：
//   NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY（见 docs/supabase-setup.md）。
// 两者缺任一（默认情况）→ flag 关，App 行为与现在完全一致（纯 localStorage）。
// 不再依赖单独的开关变量：有凭据即开，无凭据即关——一个真相来源，杜绝"开了 flag 却没配 key"。
export function isSupabaseCloudEnabled(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return typeof url === "string" && url.length > 0 && typeof anon === "string" && anon.length > 0;
}
