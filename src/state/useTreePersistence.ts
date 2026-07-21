import { useCallback, useEffect, useRef, type Dispatch } from "react";
import type { LifeTree } from "@/domain/types";
import type { AsyncTreeRepository, TreeRepository } from "@/domain/repository/types";
import { LocalStorageRepository } from "@/domain/repository/localStorageRepo";
import { SupabaseRepository } from "@/domain/repository/supabaseRepo";
import { migrateLocalToCloud } from "@/domain/repository/migrate";
import { getCloudStore } from "@/lib/supabaseClient";
import { useCloudSession } from "@/lib/useCloudSession";
import type { Action, State } from "./appReducer";

interface UseTreePersistenceOptions {
  state: State;
  dispatch: Dispatch<Action>;
  repository?: TreeRepository;
}

export function useTreePersistence({ state, dispatch, repository }: UseTreePersistenceOptions) {
  const repoRef = useRef<TreeRepository | null>(repository ?? null);
  const repo = useCallback((): TreeRepository => {
    if (!repoRef.current) repoRef.current = new LocalStorageRepository();
    return repoRef.current;
  }, []);

  // ── P5 云同步（全部在 flag 之后）──
  // flag 关（默认，无 env）：cloud.enabled=false，下面所有云分支都早退，hydrate/persist 与今天逐字一致。
  // flag 开 + 已登录：用 SupabaseRepository 取/存树（异步、防抖），首登做一次本地→云迁移。
  const cloud = useCloudSession();
  // 当前登录用户对应的云仓库（异步）。userId 变化（登录/登出）时重建；未登录 / flag 关 → null。
  const cloudRepoRef = useRef<{ userId: string; repo: AsyncTreeRepository } | null>(null);
  const cloudRepo = useCallback((): AsyncTreeRepository | null => {
    const uid = cloud.userId;
    if (!cloud.enabled || !uid) return null;
    if (cloudRepoRef.current?.userId === uid) return cloudRepoRef.current.repo;
    const store = getCloudStore();
    if (!store) return null;
    const r = new SupabaseRepository(store, uid);
    cloudRepoRef.current = { userId: uid, repo: r };
    return r;
  }, [cloud.enabled, cloud.userId]);
  // 已经为某 userId 做过迁移 + 初次云端 hydrate 的标记，避免重复。
  const cloudHydratedForRef = useRef<string | null>(null);

  // 最新 tree 的引用，供异步推演读取
  const treeRef = useRef<LifeTree | null>(null);
  useEffect(() => {
    treeRef.current = state.tree;
  }, [state.tree]);

  // 给异步推演读取的最新值：是否接入 AI、是否正在推演（用于并发保护）
  const aiEnabledRef = useRef(false);
  useEffect(() => {
    aiEnabledRef.current = state.aiEnabled;
  }, [state.aiEnabled]);
  const predictingRef = useRef(false);
  useEffect(() => {
    predictingRef.current = state.predicting !== null;
  }, [state.predicting]);

  // 挂载：读取存档并 hydrate。
  //   flag 关（默认）：同步从 localStorage 读，行为与今天逐字一致（cloud.enabled=false 立即走这支）。
  //   flag 开：等云会话 ready 后再决定——已登录则异步从云端读（首登先迁移），未登录则照旧本地读。
  // cloud.enabled 在运行期不变（env 编译期注入），故这里要么永远走同步本地支，要么永远走云支。
  useEffect(() => {
    // —— flag 关：原同步本地路径，逐字保留（只 hydrate 一次）——
    if (!cloud.enabled) {
      if (state.hydrated) return; // 已 hydrate（含 reset 后重 hydrate 由各自 action 管），不重跑
      dispatch({ type: "hydrate", tree: repo().load() });
      return;
    }
    // —— flag 开：等会话状态确定 ——
    if (!cloud.ready) return; // 还没确定登录态，先不 hydrate（page 显示"载入中…"）
    const uid = cloud.userId;
    // 未登录：与本地一致地 hydrate（一旦登录，下面 userId 变化会重跑本 effect 走云支）。
    if (!uid) {
      if (state.hydrated) return; // 已 hydrate 过就不重复（避免登出后清空树）
      dispatch({ type: "hydrate", tree: repo().load() });
      return;
    }
    // 已登录且本 userId 还没做过云 hydrate → 迁移（首登）+ 从云端读。
    if (cloudHydratedForRef.current === uid) return;
    const cr = cloudRepo();
    if (!cr) {
      // 理论上 enabled+登录时不会拿不到云仓库；兜底回退本地，不白屏。
      dispatch({ type: "hydrate", tree: repo().load() });
      return;
    }
    cloudHydratedForRef.current = uid;
    let cancelled = false;
    void (async () => {
      try {
        // 首登：本地有树 + 云端空 → 一次性把本地搬上云（幂等，不覆盖云端已有）。
        await migrateLocalToCloud(repo(), cr);
        const cloudTree = await cr.load();
        if (cancelled) return;
        // 云端读到就用云端；云端仍空（迁移也没搬，说明本地也空）→ 用本地兜底（多半也是 null → onboarding）。
        dispatch({ type: "hydrate", tree: cloudTree ?? repo().load() });
      } catch {
        if (cancelled) return;
        // 云端异常：回退本地存档 + 给一条小提示，绝不白屏。
        dispatch({ type: "hydrate", tree: repo().load() });
        dispatch({ type: "setCloudNotice", on: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // state.hydrated 仅在未登录支用到（判断是否已 hydrate）；故纳入依赖。
  }, [cloud.enabled, cloud.ready, cloud.userId, cloudRepo, dispatch, repo, state.hydrated]);

  // url 订阅源变化（增/删/改 url）→ 重新代取。以 id|url 串联成签名，签名不变则不重取。

  return { cloud, repo, cloudRepo, treeRef, aiEnabledRef, predictingRef };
}
