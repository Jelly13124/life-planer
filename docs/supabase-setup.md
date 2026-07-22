# Supabase 云同步、分享、匿名统计与账户删除

## 当前生产状态

- Supabase project ref：`ucwgdgiymxfvuryzgevi`
- Dashboard：<https://supabase.com/dashboard/project/ucwgdgiymxfvuryzgevi>
- Web Production 已配置公开 URL/key，并启用登录与云同步代码路径。
- EAS Production 已配置 Mobile 的公开 Supabase URL/key。
- Vercel Production 已配置新的 `SUPABASE_SECRET_KEY`，账户删除端点的无效 token 验证已返回预期 `401`。
- 真实邮箱登录、跨设备拉取和有效 token 删除仍需用一个测试账号做端到端验收。

仓库不保存任何 key 值。Supabase 官方已经推荐用 `sb_publishable_...` / `sb_secret_...` 代替旧 `anon` / `service_role` JWT；本项目的环境变量名称保留旧单词只是为了兼容现有代码。

## 环境变量

### Vercel / Web

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SECRET_KEY
```

可选兼容变量：

```text
SUPABASE_SERVICE_ROLE_KEY
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` 可以承载旧 anon key 或新的 publishable key。`SUPABASE_SECRET_KEY` 只允许存在于 Vercel/server；绝不能放进 `NEXT_PUBLIC_*`、`EXPO_PUBLIC_*`、源码、日志或聊天。

### EAS / Mobile

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

这两个是打入 App 的公开值，数据安全依赖 RLS。新电脑可用下面命令只核对变量名称，不显示敏感值：

```bash
cd mobile
npx eas-cli env:list production
```

## 数据表与 RLS

### `trees`

每个用户一棵 JSONB 树；用户只能访问自己的行：

```sql
create table if not exists public.trees (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.trees enable row level security;

create policy "trees_owner_rw"
  on public.trees
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
```

### `shares`

登录用户创建经过清洗的分享 payload；分享页允许公开读取：

```sql
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.shares enable row level security;

create policy "shares_public_read"
  on public.shares for select
  to anon, authenticated
  using (true);

create policy "shares_owner_insert"
  on public.shares for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
```

### `style_events`

`supabase/migrations/20260710000000_style_events.sql` 创建职业决策人格测试的匿名漏斗统计。它只记录事件名、Web/App、来源、测试版本和服务端时间，不保存答案、分数、人格码、姓名、用户、设备或流程标识。

该表不给 `anon`/`authenticated` 直接写权限。`POST /api/style-events` 在服务端使用 `SUPABASE_SECRET_KEY`，并兼容旧 `SUPABASE_SERVICE_ROLE_KEY`；数据库失败时统计静默跳过，不影响用户完成测试。

注意：现有 `trees` 与 `shares` 建表 SQL 仍保存在本文档，尚未整理成 Supabase migration；`style_events` 已有 migration。继续扩展数据库前应先从现有项目拉取一个干净 schema migration，避免手工状态继续漂移。

## Auth 配置

Supabase Dashboard 中确认：

1. Authentication → Providers → Email 已启用。
2. Authentication → URL Configuration 的 Site URL 指向生产网站。
3. Redirect URLs 至少包含生产网站和本地开发地址 `http://localhost:3000`。
4. Data API 暴露了应用实际使用的 schema/table；RLS 与 grants 是两层独立控制。

Web 使用魔法链接；Mobile 使用邮箱 OTP。首次登录时，如果云端为空而本地有树，会进行一次幂等的本地→云端迁移。之后始终保留本地副本，并对云端写入防抖。

## 账户删除

Mobile 的「我 → 账号与同步 → 删除账户与全部数据」调用：

```text
DELETE https://life-planer-opal.vercel.app/api/account
Authorization: Bearer <current user access token>
```

服务端先验证 token 对应的用户，再使用 Secret Key 删除该用户。`trees.user_id` 与 `shares.user_id` 的 `on delete cascade` 负责清理关联数据。客户端成功后清空会话和本地状态。

上线前必须用专门测试账号验证一次：创建数据 → 登录另一设备拉取 → 删除账户 → Dashboard 中确认 Auth user、tree 和 shares 都消失。

## 新电脑恢复

不从旧硬盘复制 `.env.local`。在新电脑上：

1. 登录 Supabase Dashboard，并确认能打开 project `ucwgdgiymxfvuryzgevi`。
2. 登录 Vercel，重新 link 到现有 `life-planer` project；不要创建同名新项目。
3. 登录 Expo/EAS，确认 project ID 与 `mobile/app.json` 一致。
4. 从 Dashboard/部署平台核对变量名称，不把值写入仓库。
5. 如需本地 AI，再从自己的安全密码管理器手工创建 `.env.local`。

## 最小验证清单

- 未配置公开 Supabase 变量：应用仍能以本地模式启动。
- 已配置且未登录：显示登录入口，不读取别人的数据。
- 首次登录：本地树只在云端为空时迁移，不覆盖已有云端树。
- 断网/云端失败：回退本地，不白屏、不清数据。
- 分享链接：匿名浏览器可读分享 payload，但不能直接写入。
- `DELETE /api/account`：无 token/坏 token 返回 `401`；缺服务端 secret 才返回 `503`。
- 所有公开表启用 RLS，并定期查看 Supabase Security Advisor。
