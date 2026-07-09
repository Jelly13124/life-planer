// 分享卡 payload 的共享契约 —— 手机端建卡（mobile/src/lib/supabase.ts）与网页公开卡片页
// （src/app/s/[id]/shareData.ts）曾各自维护一份同形状的类型，靠注释承诺"两处保持一致"。
// 放进共享核心后由 TypeScript 强制同步：任一端改了字段，另一端不导入就会编译不过。
// 只是类型定义，不含校验/裁剪逻辑——网页端服务器侧需要处理"不可信输入"，那部分逻辑
// 留在 shareData.ts 的 sanitizePayload，不适合放进纯领域核心。
export type ShareKind = "tree" | "future-self" | "path";

export interface ShareItem {
  label: string;
  feasibility?: number;
}

export interface SharePayload {
  kind: ShareKind;
  title: string;
  subtitle?: string;
  name?: string; // 昵称（可空——只传 profile.name，不传其他隐私）
  items?: ShareItem[]; // 至多 3 条（tree/path 卡）
  quote?: string; // future-self 卡
}
