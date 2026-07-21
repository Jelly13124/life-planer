# Supabase 云端存档 + 登录接入指南（P5）

本仓库已经把 **云同步 + 魔法链接登录** 全部接好了，但**默认关闭**：只要不配两个 `NEXT_PUBLIC_SUPABASE_*` 环境变量，App 行为与现在完全一致（纯 localStorage，零网络，不创建任何 Supabase 客户端）。

开关由"两个公开环境变量是否都配齐"驱动，无需单独的开关变量：

- 两者都为非空字符串 → `isSupabaseCloudEnabled()` 返回 `true`，云同步开启。
- 缺任一（默认）→ `false`，App 走本地 localStorage，与今天逐字一致。

> 早上你要做的，就是 §2 建表 + §3 填两个环境变量。填完即开，无需改代码。

接好的部分：

- `src/lib/featureFlags.ts` — `isSupabaseCloudEnabled()`，读两个公开 env 的"是否都配齐"。
- `src/lib/supabaseClient.ts` — 懒加载浏览器客户端（`getSupabase()` 未配置时返回 `null`，绝不抛错）+ `getCloudStore()`（把 supabase-js 适配成 `CloudStore`）+ `getCurrentUserId()`。
- `src/lib/useCloudSession.ts` — React 钩子，订阅 Supabase 会话；flag 关时是稳定的 disabled 态（不订阅、不取会话）。
- `src/components/CloudAuth.tsx` — 侧栏底部「云同步」入口（魔法链接登录 / 已登录显示邮箱 + 退出）。**flag 关时渲染 `null`，无任何 UI。**
- `src/components/CloudNotice.tsx` — 云端加载失败回退本地时的一条小提示（flag 关时渲染 `null`）。
- `src/state/AppContext.tsx` — 已接异步云端：flag 开 + 已登录时从 `SupabaseRepository` 读/防抖写树；首登做一次本地→云迁移；flag 关 / 未登录时走原 localStorage 路径，逐字不变。
- `packages/core/src/repository/supabaseRepo.ts` — `SupabaseRepository`，依赖窄接口 `CloudStore`（便于 mock）。
- `packages/core/src/repository/migrate.ts` — `migrateLocalToCloud`，首次登录把本地树搬到空云端（幂等，不覆盖云端已有）。
- `packages/core/src/repository/normalize.ts` — `normalizeLoadedTree`，本地与云端共用的校验/旧数据补字段（云端读到的树也会过它）。

> supabase-js 仍在演进。正式接入前可对照 https://supabase.com/docs 再核一遍 `signInWithOtp` / `auth.getSession` / RLS 用 `auth.uid()` 的写法。

---

## 1. 依赖

`@supabase/supabase-js` 已经装进 `package.json`（本次 P5 一并装了），无需再装。它只在云相关模块里 import，flag 关时不会被实际执行。

---

## 2. 建项目 + 建表 + 开 RLS

1. 在 https://supabase.com 新建一个 project（免费档即可）。
2. 进 **SQL Editor**，粘贴并运行下面的 SQL。每个用户一行，整棵 `LifeTree` 存成 `jsonb`：

```sql
-- 1) 建表：一个用户一行
create table public.trees (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2) 开行级安全
alter table public.trees enable row level security;

-- 3) 策略：用户只能读写自己那一行（auth.uid() 取自 JWT）
create policy "trees_owner_rw"
  on public.trees
  for all
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );
```

`primary key` 保证一个用户只有一棵树；`on delete cascade` 让删用户时连带清掉树。`for all` 一条策略覆盖 select/insert/update/delete，`using` 管读、`with check` 管写。

3. 进 **Authentication → Providers**，确认 **Email** 开着（默认开）。魔法链接（OTP）即用它。
4. 进 **Authentication → URL Configuration**，把 **Site URL** 设成你的站点地址（本地开发填 `http://localhost:3000`；部署后填线上域名），并在 **Redirect URLs** 里加上同样的地址——魔法链接点开后会回到这里。

---

## 3. 环境变量

在 `.env.local`（以及部署平台的环境变量里）配这两个：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<你的 anon / publishable key>
```

两个都填了非空值 → 云同步开启。任一留空或不写 → App 继续走本地 localStorage，与现在完全一致。

> 这两个值在 Supabase 控制台 **Project Settings → API** 里：`Project URL` 和 `anon public` key。`anon` key 是公开 key（前端可见），安全性由上面的 RLS 策略保证。

> ⚠️ 本仓库的 `.gitignore` 忽略了所有 `.env*`，且有一个 `guard-env` 钩子禁止工具读写 `.env*`（防止泄露 DeepSeek key）。因此 **`.env.local.example` 没法由工具生成**——上面这段就是你要手动加进 `.env.local` 的两行（连同注释）。把它当作 example 用即可。

### 可选：`.env.local.example`（手动建）

如果你想给团队留一个示例文件，手动新建 `.env.local.example`（它也会被 gitignore，不会进库）：

```bash
# 云同步（P5）。两者都填非空 = 开启云同步 + 魔法链接登录；
# 任一留空 / 不写 = 保持本地存档模式（默认，与不接云时行为完全一致）。
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## 4. 跑起来 + 验证

1. `npm run dev`（或部署），打开 App。
2. 侧栏底部会出现「云同步」入口（仅在两个 env 配齐时）。点开 → 输入邮箱 → 「发送登录链接」。
3. 去邮箱点开魔法链接 → 自动跳回 App 并登录。侧栏底部变成「已登录 + 邮箱 + 退出登录」。
4. 首次登录时：若本地已有人生树而云端为空，会自动把本地树搬到云端（一次性，幂等，不覆盖云端已有）。之后所有改动防抖写入云端（同时仍写本地一份作离线兜底）。
5. 换一台设备 / 清掉本地缓存后用同一邮箱登录 → 应能拉回云端那棵树。

### 行为细节（已实现）

- **加载**：flag 开 + 已登录 → 从云端 `load()`（异步），结果过 `normalizeLoadedTree`（旧树自动补 `goals/activity/...`）。云端为空但本地有树 → 走迁移后再读。
- **持久化**：每次 tree 变化都同步写 localStorage（离线兜底 / 迁移源），并防抖 ~800ms 写云端。
- **登出**：清掉会话，回到未登录态（本地存档仍在）。
- **重置**（`reset()`）：清本地 + 已登录时连带清云端那一行。
- **容错**：云端 `load` 抛错（断网等）→ 回退本地存档 + 底部弹一条「云端连接异常，已暂时改用本地存档」的小提示，**绝不白屏**。`save`/`clear` 静默失败不崩。

---

## 5. 没接真实 Supabase 的测试

云路径用内存 mock（`CloudStore`）做单测，零网络零密钥：

- `packages/core/src/repository/__tests__/supabaseRepo.test.ts` — 存/取/补字段/JSON 字符串/容错。
- `packages/core/src/repository/__tests__/migrate.test.ts` — 三种迁移结果。
- `src/lib/__tests__/featureFlags.test.ts` — flag 由两个 env 是否配齐驱动。
- `src/lib/__tests__/supabaseClient.test.ts` — 未配置时 `getSupabase()/getCloudStore()` 返回 `null`、不抛错。
- `src/components/__tests__/CloudAuth.test.tsx` — flag 关时渲染 `null`；flag 开时魔法链接表单 / 已登录态。

> 真实云端联通（魔法链接邮件、RLS、跨设备同步）需要你填了凭据后手动验一遍——单测覆盖不到真服务器。

## 6. 职业决策风格测试的匿名统计

`supabase/migrations/20260710000000_style_events.sql` 创建了一个只包含测试漏斗元数据的 `style_events` 表。它只保存事件名称、端（`web` / `app`）、来源（`direct` / `shared` / `compare`）、测试版本和服务端时间戳；不保存答案、分数、标签、分享码、姓名、账号、设备或流程标识。

表启用 RLS，不给匿名或登录用户直接读写权限。Web API 使用仅存在于服务端的 `SUPABASE_SERVICE_ROLE_KEY` 做尽力写入；缺少配置或 Supabase 暂时不可用时，测试仍正常完成。迁移会在 `pg_cron` 可用时安排每日清理，删除 30 天以前的事件。

## 7. App 内删除账户（上线必需）

移动端「我 → 账号与同步 → 删除账户与全部数据」会携带当前 Supabase access token 请求网站的 `DELETE /api/account`。服务端会先通过 Supabase Auth 重新验证 token，只删除该 token 对应的用户，然后依靠 `trees`、`shares` 对 `auth.users` 的 `on delete cascade` 清理关联数据。管理员密钥绝不能放进 `NEXT_PUBLIC_*` 或 `EXPO_PUBLIC_*` 变量。

在 Vercel Production 环境配置下面其中一个服务端变量：

```bash
# 推荐的新式 Supabase server secret
SUPABASE_SECRET_KEY=sb_secret_...

# 或兼容旧项目的 service_role JWT（2026 年底前仍受支持）
SUPABASE_SERVICE_ROLE_KEY=...
```

部署后，未携带登录 token 请求该接口应返回 `401`；有效登录用户确认删除后应回到未登录、未引导状态，并且 Authentication 用户、`trees` 与 `shares` 中的关联行都不再存在。
