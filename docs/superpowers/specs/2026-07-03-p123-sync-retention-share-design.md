# P1 手机云同步+账号 · P2 留存引擎 · P3 可晒卡

- 日期：2026-07-03
- 状态：设计已确认（brainstorming 四决策已敲定），subagent 顺序执行 P1→P2→P3
- 来源：竞品审计（2026-07-02）三大致命差距的前三期补强。范围：手机为主 + 少量核心纯函数 + 网页分享页。

## 已敲定的决策
1. **登录可跳过、本地优先**：不登录照常用（AsyncStorage），登录后才开云同步。登录入口在「我」tab，不挡 onboarding。
2. **冲突 = updatedAt 新的赢**：登录/启动时对比云端与本地树的 `updatedAt`，新者为准；**覆盖本地前把本地树备份**（AsyncStorage 备份键）。
3. **补签/冻结：每月免费 2 张、自动使用**：断签日自动消耗一张保住连续，每月 1 号重置。
4. **P3 只做可晒卡**（好友比路径下一轮）。

## 关键事实（已核实）
- 核心 `SupabaseRepository`（`packages/core/src/repository/supabaseRepo.ts`）只依赖窄接口 `CloudStore{getTree/putTree/deleteTree}` + userId——手机只需实现 CloudStore。
- 网页已跑通：`src/lib/supabaseClient.ts`（`getSupabase/getCurrentUserId/getCloudStore`，`trees` 表一人一行 jsonb，RLS）+ AppContext 防抖 800ms 云写 + hydrate 云优先。Supabase 项目 `ucwgdgiymxfvuryzgevi`（URL = `https://ucwgdgiymxfvuryzgevi.supabase.co`）。
- **`@supabase/supabase-js` 纯 JS → OTA 可发**（无原生模块）。RN 下需 `react-native-url-polyfill`（纯 JS）+ AsyncStorage 作 auth storage（已装）。
- **anon key 是公开钥匙**（RLS 保护，本就内联在网页 bundle 里）——可从已部署网页的 JS bundle 提取，或用户从 Supabase 后台复制。
- 手机通知库已存在（`mobile/src/lib/notifications.ts`，Expo Go no-op、正式包可用，`syncNotifications` 排任务提醒）。
- `currentStreak(tree, today)`（core daily.ts）：从 today 往前数连续"完成≥1"天，今天未完成则从昨天起算。
- 网页晒卡已有一套：`src/lib/treeShareImage.ts`（`buildShareSvg(tree, labels)`）+ 路径码公开页 `/t/[code]`（含 OG 元数据）——P3 复用此模式。
- **手机截图分享不可行（本轮）**：view-shot/expo-sharing 是原生模块、build 17 没带 → 走 OTA 会崩。**改走「分享链接到网页卡片页」**：RN 内置 `Share.share`（核心 API，可用）分享 URL；网页卡片页带 OG 图，微信/小红书预览直接出图，且把流量导回网页漏斗。

## P1 — 手机云同步 + 账号（可跳过、本地优先）

### 环境/配置
- 新增 EXPO 公共变量：`EXPO_PUBLIC_SUPABASE_URL`、`EXPO_PUBLIC_SUPABASE_ANON_KEY`。**必须 `eas env:create` 注册进 production/preview 环境**（吸取 OTA 丢 env 的教训），发 OTA 时照旧 inline 一份保险。anon key 获取：从 `https://life-planer-opal.vercel.app` 的 JS bundle 里 grep `supabase.co` 附近的 anon key（公开信息），或让用户从 Supabase 后台复制。
- **用户操作（一次性，2 分钟）**：Supabase Dashboard → Auth → Email Templates → Magic Link 模板加入 `{{ .Token }}`（6 位验证码），使邮箱 OTP 流可用。手机走 OTP 码流（`signInWithOtp` → `verifyOtp({email, token, type:"email"})`），**不需要** Site URL/深链配置。

### 手机实现
- `mobile/src/lib/supabase.ts`（新）：镜像网页 `supabaseClient.ts`——`isCloudEnabled()`（两个 env 均非空）、懒单例 `getSupabase()`（`auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }`）、`getCloudStore()`（逐字复用网页的 trees 表适配）、`getCurrentUserId()`。顶部 `import "react-native-url-polyfill/auto"`。
- 登录 UI（「我」tab `MeScreen`）：未登录 → 「登录以开启云同步」卡（邮箱输入 → 发验证码 → 6 位码输入 → 登录）；已登录 → 显示邮箱 + 「退出登录」+ 最近同步时间。全程可跳过。
- store 接线（`mobile/src/state/store.tsx`）：
  - 登录成功/启动已有会话时：`cloudLoad()` = 取云端树 + 本地树，按 `updatedAt` 新者胜；若云端胜 → 本地树先备份到 `lifeplanner.tree.backup` 键再覆盖；若本地胜 → 立即上写云端。
  - `commit()` 追加防抖 800ms 云写（已登录时；镜像网页模式，吞错不崩）。
  - 「退出登录」只断同步不删本地；「重置数据」时若已登录连带删云端行（镜像网页）。
- 同步状态轻提示：MeScreen 显示「已同步/同步失败(重试)」；不做全局 toast 骚扰。

## P2 — 留存引擎（连击 + 补签 + 成长反馈 + 每日推送）

### 核心（纯函数，TDD）
- `LifeTree.freezeDays?: string[]`（被冻结保护的日期，可选字段，normalize 补空数组不迁移）。
- `packages/core/src/streak.ts`（新）：
  - `FREE_FREEZES_PER_MONTH = 2`；`freezesUsedInMonth(tree, month)`（数 freezeDays 里该月的天数）；`freezesLeft(tree, today)`。
  - `currentStreakWithFreeze(tree, today)`：同 `currentStreak` 但 freezeDays 里的日期视为"完成"。
  - `applyAutoFreeze(tree, today)`：纯函数——检查昨天往前的断签缺口（最多回看 2 天），本月还有免费张数则把缺口日写进 freezeDays，返回新树 +使用明细；无缺口/无张数返回原树。
- `daily.ts` 的 `currentStreak` 保持不动（网页兼容）；手机与后续网页改用 `currentStreakWithFreeze`。

### 手机
- 启动/回前台时（state 层）调 `applyAutoFreeze` 并 commit；用了冻结就弹温和 nudge「补签卡帮你保住了 N 天连击」。
- 人生树 tab 顶部加连击条：火焰 + 「连续 N 天」+ 本月剩余补签卡（小图标 ×2/×1/×0）；完成任务当天首次 → 连击 +1 庆祝动画（轻量 Animated，尊重 reduce-motion）。
- 每日推送（用现有 notifications 库，Expo Go no-op）：每天早上（默认 09:00，作息窗起点后 2h 取整）一条本地通知：「今天 N 个任务在等你 · 连击 M 天」；无任务时改为「给未来的自己留 10 分钟」。在 MeScreen 给开关（默认开，需通知权限）。

## P3 — 可晒卡（分享链接 → 网页卡片页，导流回漏斗）

- **三种卡**：①人生树卡（选定路 + 可行度 + 树剪影）②未来自我寄语卡（未来自我聊天里的一句话）③路径码卡（已有 `/t/[code]`，只补手机分享入口）。
- 网页新增公开卡片页 `/s/[id]`：渲染卡片（复用 `treeShareImage` 的视觉语言做 OG 图 + 页面）+ 底部 CTA「测测你的人生树」→ onboarding/路径码测试。**OG 元数据必须有**（微信/小红书预览出图）。
- 数据通道：Supabase 新表 `shares`（`id uuid pk, payload jsonb, created_at`；RLS：任何人可按 id select，仅登录用户 insert 自己的）。**建表 SQL 写在 spec/plan 里交用户在 Supabase SQL Editor 粘贴执行**（MCP 当前未授权）。payload 只存**脱敏后的卡片数据**（名字默认化名/可选、路径标签、可行度、寄语文本）——绝不存整棵树。
- 手机分享入口：路径详情页「分享这条路」、未来自我聊天消息长按「做成卡片分享」、「我」tab「晒我的人生树」。流程：组 payload → insert shares 得 id → `Share.share({ message: "我的人生树 · <标题>", url: "https://life-planer-opal.vercel.app/s/<id>" })`。未登录/离线 → 提示登录或稍后（shares insert 需登录，防匿名灌库）。
- 网页端同卡片也加「分享」按钮（复制链接）。

## 护栏
- 核心纯净（streak/freeze 全纯函数 TDD，时间注入）；i18n 追加式；无 emoji（火焰用线性图标）；苹果白/现有 RN theme。
- 每期收口：`cd mobile && npx tsc --noEmit`；动网页/核心 → `/green`。每期各自提交 + OTA（P3 的网页页随 master→Vercel）。
- 隐私：shares 只存脱敏卡片数据；分享前预览让用户看到将公开的内容。
- Supabase env 缺失时（未配 EXPO_PUBLIC_*）：登录卡显示「云同步未配置」，一切照旧本地。

## 用户操作清单（我会在对应期提醒）
1. P1 前：Supabase 后台 Email 模板加 `{{ .Token }}`；（若我从 bundle 提取 anon key 失败）复制 anon key 给我。
2. P3 前：Supabase SQL Editor 执行 `shares` 建表 SQL（plan 里给全文）。

## 非目标（YAGNI）
- 好友关系/比路径、实时协同、多树、网页端 freeze 改造（网页 streak 下轮跟进）、Android 推送、截图直出图片卡（等下次原生 build 带 view-shot 再加）。

## 验证/交付（真机）
- P1：手机登录 → 网页登同一账号 → 两端改动互通（新者胜）；退出登录本地照常。
- P2：断一天签自动消耗补签卡且连击不断；早推送到达；连击条/庆祝动画正常。
- P3：手机分享出链接 → 微信里预览出图 → 打开是卡片页带 CTA。
