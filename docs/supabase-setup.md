# Supabase 云端存档接入指南

本仓库已经放好了 **云端存档的骨架**（flag-gated、用内存 mock 测过），但默认走 localStorage、不连任何网络、也没装任何依赖。本文记录把它真正接上 Supabase 需要做的事。

骨架包含：

- `src/domain/repository/types.ts` —— `AsyncTreeRepository` 接口（`load/save/clear` 都返回 Promise）。
- `src/domain/repository/supabaseRepo.ts` —— `SupabaseRepository` 实现，只依赖一个窄接口 `CloudStore`（便于 mock）。
- `src/domain/repository/normalize.ts` —— `normalizeLoadedTree`，本地与云端共用的校验/旧数据补字段逻辑。
- `src/domain/repository/migrate.ts` —— `migrateLocalToCloud`，首次登录把本地树搬到云端。
- `src/lib/featureFlags.ts` —— `useSupabaseCloud()`，读 `NEXT_PUBLIC_USE_SUPABASE`。

> 文档里的 supabase-js 示例参照了 Context7 抓取的当前文档（`from().select()/upsert()/delete()`、`auth.getUser()`、RLS 用 `auth.uid()`）。supabase-js 仍在演进，正式接入前请对照 https://supabase.com/docs 再核一遍。

---

## 1. 安装依赖

```bash
npm install @supabase/supabase-js
```

（骨架阶段刻意没装它，所以现在仓库零新增依赖。）

---

## 2. 建表 + 开 RLS

每个用户一行，整棵 `LifeTree` 存成 `jsonb`：

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

---

## 3. 环境变量

在 `.env.local`（以及部署平台的环境变量里）配：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<你的 anon/publishable key>
NEXT_PUBLIC_USE_SUPABASE=1
```

只有 `NEXT_PUBLIC_USE_SUPABASE=1` 时 `useSupabaseCloud()` 才返回 true。不配或配成别的值，App 继续走本地 localStorage，行为与现在完全一致。

---

## 4. 把真实 supabase-js 适配成 `CloudStore`

`SupabaseRepository` 不直接 import supabase-js，只依赖这个窄接口（来自 `supabaseRepo.ts`）：

```ts
export interface CloudStore {
  getTree(userId: string): Promise<unknown | null>;
  putTree(userId: string, tree: LifeTree): Promise<void>;
  deleteTree(userId: string): Promise<void>;
}
```

下面是一个用 supabase-js 实现它的示例（建议放在 `src/lib/supabaseStore.ts`，接入时新建）：

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LifeTree } from "@/domain/types";
import type { CloudStore } from "@/domain/repository/supabaseRepo";

// 浏览器端单例客户端
export const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// 拿当前登录用户的 id（没登录返回 null）
export async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

// 把 supabase-js 适配成 CloudStore。注意：RLS 已经保证只能读写自己那一行，
// 这里仍按 user_id 过滤，既清晰也省流量。
export const supabaseStore: CloudStore = {
  async getTree(userId) {
    const { data, error } = await supabase
      .from("trees")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle(); // 没有行时返回 data=null，而不是报错
    if (error) throw error;
    return data?.data ?? null; // data.data 就是存进去的 LifeTree JSON
  },

  async putTree(userId, tree: LifeTree) {
    const { error } = await supabase
      .from("trees")
      .upsert(
        { user_id: userId, data: tree, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }, // 同一 user_id 已存在则覆盖
      );
    if (error) throw error;
  },

  async deleteTree(userId) {
    const { error } = await supabase.from("trees").delete().eq("user_id", userId);
    if (error) throw error;
  },
};
```

有了它就能构造仓库：

```ts
import { SupabaseRepository } from "@/domain/repository/supabaseRepo";
import { supabaseStore, getCurrentUserId } from "@/lib/supabaseStore";

const userId = await getCurrentUserId();
if (userId) {
  const cloudRepo = new SupabaseRepository(supabaseStore, userId);
  // cloudRepo.load() / save() / clear() 都是 async
}
```

`SupabaseRepository.load()` 已经把 `getTree` 的返回（对象或 JSON 字符串都行）丢给 `normalizeLoadedTree`，所以旧树缺 `goals/activity/decisions` 会被自动补成 `[]`；任何抛错（断网等）都吞掉返回 `null`，不会崩。`save()`/`clear()` 同样静默失败。

---

## 5. 剩余接线步骤（本骨架没做，开 flag 时要补）

当前 `AppContext` 用的是 **同步** 的 `TreeRepository`（localStorage）。云端是异步的，接上需要把 `AppContext` 改成 async：

1. **选仓库**：在 `AppProvider` 里判断 `useSupabaseCloud()`。为 true 且已登录时，用 `new SupabaseRepository(supabaseStore, userId)`；否则继续用 `LocalStorageRepository`。
2. **hydrate 变 async**：现在的挂载 effect 是 `dispatch({ type: "hydrate", tree: repo().load() })`（同步）。云端要 `await repo().load()` 再 dispatch。建议把 `repo()` 抽象成一个统一的 async 取数函数（本地仓库用 `Promise.resolve(repo.load())` 包一层即可），让 hydrate / save 两条路径都 `await`，不用在两套同步/异步分支里复制逻辑。
3. **持久化 effect 变 async**：`repo().save(tree)` 同样改成 await（fire-and-forget 也行，但要处理 reject）。
4. **首次登录迁移**：登录成功拿到 `userId` 后，调用一次

   ```ts
   import { migrateLocalToCloud } from "@/domain/repository/migrate";
   const result = await migrateLocalToCloud(localRepo, cloudRepo);
   // "migrated" / "skipped-no-local" / "skipped-cloud-exists"
   ```

   只有“本地有树 + 云端为空”才会真正搬运，幂等、可重复调用，不会覆盖云端已有的树。

> 这步刻意留到开 flag 时做：把 `AppContext` 改 async 牵涉到 hydrate 时序、predicting 并发保护、SSR 水合等，需要单独一个改动 + 一轮回归测试，不混进骨架里。

---

## 6. 认证 UI 还没做

上面的示例假设用户已经登录（`auth.getUser()` 能拿到 id）。但本仓库目前没有任何登录/注册界面，也没有 Supabase Auth 的接线。**登录 UI 是后续单独的一个 follow-up**（邮箱魔法链接或 OAuth 皆可），不在本骨架范围内。在它落地之前，把 `NEXT_PUBLIC_USE_SUPABASE` 留空、继续用本地存档即可。
