// 分享域名：卡片底注 + OG 链接预览。换正式域名改这一处（或设 NEXT_PUBLIC_SHARE_DOMAIN）。
// 镜像：mobile/src/lib/supabase.ts 的 SHARE_BASE_URL（走 EXPO_PUBLIC_SHARE_DOMAIN）——换域名时两处一起改。
export const SHARE_DOMAIN =
  process.env.NEXT_PUBLIC_SHARE_DOMAIN?.trim() || "life-planer-opal.vercel.app";

export function resultUrl(code: string): string {
  return `https://${SHARE_DOMAIN}/t/${code}`;
}
