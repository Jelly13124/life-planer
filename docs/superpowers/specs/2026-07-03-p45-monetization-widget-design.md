# P4 变现骨架（RevenueCat 订阅 + AI 用量制）· P5 iOS 桌面小组件

- 日期：2026-07-03
- 状态：设计已确认（四决策：AI 用量制 / ¥68年+¥12月+7天试用 / RevenueCat / ¥199 深度推演延后）
- 范围：手机为主 + 核心纯函数（配额）+ 网页两个静态页（/privacy /terms，Apple 审核硬要求）。**本期是原生期：react-native-purchases 与 widget 都是原生 → 一次 EAS build（版本升 1.1.0）+ TestFlight + 苹果审核。**

## 关键纪律（吸取教训）
- **版本升 1.1.0**（app.json version；runtimeVersion=appVersion → 新 runtime）。RC/widget 代码**绝不能 OTA 到 runtime 1.0.0**（build 17 没有原生代码会崩）。**RC 代码合入分支后冻结对 production(1.0.0) 的 OTA**，仅允许从合入前的提交 cherry-pick 热修。build 后新 OTA 全部发往 1.1.0。
- build 前跑 `npx expo install --check`（memory `expo-dep-alignment`）。
- 新 env：`EXPO_PUBLIC_REVENUECAT_IOS_KEY`（RC 公开 Apple key，appl_ 开头）→ 注册 EAS env + build/OTA 时 inline。缺 key 时购买功能优雅降级（isPro=false、购买按钮显示「暂未开放」），配额照常执行。
- Android 本期不做购买（无 Play 配置）：购买 UI 仅 iOS 展示。

## P4A — AI 用量配额（核心纯函数 + store 接线）

### 规则（已定）
- **免费不计数（aha 完整保留）**：onboarding「维持现状」推演；用户新建分支的**首次**推演（`scenario==="likely"` 且 `!isEnriched`）；「推演现状」（status-quo 任何 enrich）。
- **计数（每次 1 点）**：三走向变体推演（非 likely 的 enrich）；已推演路的重推（retryEnrich on enriched）；`decomposePathIntoGoals`；`suggestGoals`；`suggestTasksForGoal`；未来自我聊天**每条用户消息**。
- **额度**：免费 20 点/自然月；Pro 无限。月字符串（YYYY-MM）翻月即重置。
- 数据：`LifeTree.aiOps?: { month: string; used: number }`（可选字段，随 P1 云同步跨设备一致；normalize 不需迁移）。
- 超额且非 Pro → 不发 AI 请求，弹 Paywall。

### 核心 `packages/core/src/aiQuota.ts`（TDD）
`FREE_AI_OPS_PER_MONTH = 20`；`aiOpsUsed(tree, today)`（月不匹配 → 0）；`aiOpsLeft(tree, today)`；`consumeAiOp(tree, today)`（月翻转重置后 +1，返回新树）；`canUseAi(tree, today, isPro)`。纯、确定性。

## P4B — RevenueCat 订阅

- 依赖 `react-native-purchases`（原生）。`mobile/src/lib/purchases.ts`：`initPurchases()`（key 缺失 no-op）、`getIsPro(): Promise<boolean>`（entitlement `"pro"`，RC 缓存离线可用，未知 → false）、`getOfferings()`、`purchase(pkg)`、`restore()`；监听 customerInfo 更新 → store 的 `isPro` state。
- 商品（用户在 ASC 建，RC 关联）：`lp_pro_annual` ¥68/年（**7 天免费试用** intro offer）、`lp_pro_monthly` ¥12/月；RC entitlement `pro`、offering `default`。
- **Paywall sheet**（Modal，苹果合规）：权益列表（无限 AI 推演/三走向/AI 拆解与建议/未来自我畅聊）、两档价格（年费高亮+「7 天免费试用」角标）、购买按钮、**恢复购买**、**服务条款 + 隐私政策链接**（指向网页 /terms /privacy）、「AI 额度下月自动重置，免费也能一直用」诚实注脚。触发：额度耗尽时、以及「我」页「升级 Pro」入口。
- 「我」页 Pro 卡：当前状态（免费·本月剩 X 点 / Pro·有效期）、升级/恢复购买、管理订阅（`Linking.openURL` 到系统订阅管理）。

## P4C — 网页 /privacy 与 /terms（Apple 硬要求）
两个静态页（App Router 简单页面，中文为主 + 英文段落）：隐私政策（数据本地+Supabase 云同步、AI 调用经我们后端、不出售数据、联系邮箱）与服务条款（订阅条款/自动续费/退款走 Apple、AI 内容为可能性非预测的免责）。ASC 元数据也要填这两个 URL（用户操作）。

## P5 — iOS 桌面小组件（WidgetKit via @bacons/apple-targets）
- 配置插件 `@bacons/apple-targets`：`targets/widget/` SwiftUI target + App Group `group.com.jelly13124.lifeplanner`（主 app + widget 共享）。
- 数据通道：store 的 commit 去抖回调里（跟通知重排同一个 timer）用插件的 `ExtensionStorage` 写快照 JSON 到 App Group UserDefaults：`{ streak, todayCount, chosenLabel, chosenFeasibility, updatedAt }`，并 `reloadWidget()`。
- Widget（SwiftUI，苹果白风格）：small = 火焰+连续 N 天 + 今日 N 个任务；medium = 另加选定路线标签 + 可行度条。点击打开 app。
- **契约**：Swift 读的 UserDefaults key/JSON 字段与 JS 写入端一字不差（spec 即契约：key `widgetSnapshot`）。
- **应急预案**：若插件/EAS 构建缠斗超过合理迭代，widget 从 build 18 摘除、随下个 build 交付——**不许拖住订阅上线**。

## 用户前置操作（缺一不可，代码不阻塞但 build/测试阻塞）
1. **ASC：Paid Apps 协议 + 银行/税务**（未生效则一切白搭，先去签）。
2. **RevenueCat 账号** → 新项目 → iOS app（bundle id `com.jelly13124.lifeplanner`）→ 把 **公开 Apple API key（appl_…）发我**。
3. **ASC 建订阅**：订阅组「Pro」→ `lp_pro_annual`（¥68/年 + 7 天免费试用 intro offer）、`lp_pro_monthly`（¥12/月），配中文展示名，随下个 build 提审。
4. **RC 后台**：导入两商品 → entitlement `pro` → offering `default`。
5. ASC App 元数据填 隐私政策 URL + 用户协议 URL（P4C 上线后的地址）。

## 交付顺序
P4A 配额（核心 TDD + store 接线，与原生无关可先行）→ P4C 网页两页 → P4B RC 库+Paywall+我页 → P5 widget → 控制器：`expo install --check` + 版本 1.1.0 + `eas build --auto-submit`（等用户 RC key 到位）→ TestFlight 沙盒验购买。

## 非目标（YAGNI）
¥199 深度推演、Android 购买、Watch、促销/涨价实验、服务端配额强校验（当前客户端配额+树同步足够；防刷等有真实营收后再加）。
