// RevenueCat 封装 —— 原生模块（react-native-purchases），仅在 1.1.0+ 正式包可用。
// Expo Go / 旧包 / 未配 key 时全部安静降级：purchasesAvailable()=false，isPro 恒 false。
// 惰性加载模式对齐 mobile/src/lib/notifications.ts：绝不在模块顶层 import 原生库，
// 只在真正需要时 await import(...)，且吞掉任何加载失败（未做原生链接的旧 runtime）。
import { Platform } from "react-native";
import type { CustomerInfo, PurchasesPackage as RCPackage } from "react-native-purchases";

const KEY = (process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "").trim();

export function purchasesAvailable(): boolean {
  return Platform.OS === "ios" && KEY.length > 0;
}

type PurchasesModule = typeof import("react-native-purchases").default;
let mod: PurchasesModule | null = null;
async function getPurchases(): Promise<PurchasesModule | null> {
  if (!purchasesAvailable()) return null;
  if (mod) return mod;
  try {
    mod = (await import("react-native-purchases")).default;
    return mod;
  } catch {
    return null; // 原生模块不存在（Expo Go / 旧 runtime）
  }
}

function hasPro(info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active["pro"]);
}

let configured = false;

// 启动时调用：configure + 读初始状态 + 订阅变更。失败静默（isPro 维持 false）。
export async function initPurchases(onProChange: (isPro: boolean) => void): Promise<void> {
  const P = await getPurchases();
  if (!P) return;
  try {
    if (!configured) {
      P.configure({ apiKey: KEY });
      configured = true;
    }
    P.addCustomerInfoUpdateListener((info) => onProChange(hasPro(info)));
    const info = await P.getCustomerInfo();
    onProChange(hasPro(info));
  } catch {
    // 静默：网络/配置问题不打扰用户
  }
}

export interface ProPackage {
  id: string; // RC package identifier
  title: string; // 我们自己的展示名（年度/月度）
  priceString: string; // RC 本地化价格串
  isAnnual: boolean;
  raw: RCPackage; // 原始 package，购买时传回
}

export async function getProPackages(): Promise<ProPackage[]> {
  const P = await getPurchases();
  if (!P) return [];
  try {
    const offerings = await P.getOfferings();
    const pkgs = offerings.current?.availablePackages ?? [];
    return pkgs.map((p) => ({
      id: p.identifier,
      isAnnual: p.packageType === P.PACKAGE_TYPE.ANNUAL,
      title: p.packageType === P.PACKAGE_TYPE.ANNUAL ? "年度会员" : "月度会员",
      priceString: p.product.priceString,
      raw: p,
    }));
  } catch {
    return [];
  }
}

// 购买/恢复：返回 { isPro, error }；用户取消不算错误（error 为 null，isPro 不变）。
export async function purchasePro(pkg: ProPackage): Promise<{ isPro: boolean; error: string | null }> {
  const P = await getPurchases();
  if (!P) return { isPro: false, error: "购买暂未开放" };
  try {
    const { customerInfo } = await P.purchasePackage(pkg.raw);
    return { isPro: hasPro(customerInfo), error: null };
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) return { isPro: false, error: null };
    return { isPro: false, error: "购买失败，请稍后再试" };
  }
}

export async function restorePro(): Promise<{ isPro: boolean; error: string | null }> {
  const P = await getPurchases();
  if (!P) return { isPro: false, error: "购买暂未开放" };
  try {
    const info = await P.restorePurchases();
    return { isPro: hasPro(info), error: null };
  } catch {
    return { isPro: false, error: "恢复失败，请稍后再试" };
  }
}
