"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { IcsEvent, LifePath, LifeTree } from "@/domain/types";
import { fetchIcsEvents } from "@/lib/icsClient";
import type { PathGenerator } from "@/domain/generator/types";
import { localGenerator } from "@/domain/generator/localGenerator";
import type { TreeRepository } from "@/domain/repository/types";
import { applyEnrichment, fetchEnrichEnabled, fetchEnrichment } from "@/lib/enrichClient";
import { useTreePersistence } from "./useTreePersistence";

import { initialState, reducer } from "./appReducer";
export type { Predicting, View } from "./appReducer";

import { useAppApi, type AppApi } from "./useAppApi";

const AppContext = createContext<AppApi | null>(null);

// "正在推演"动画至少播这么久——即便没接 AI / 本地秒出，也让过场有质感。
const MIN_PREDICT_MS = 1600;
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function AppProvider({
  children,
  generator = localGenerator,
  repository,
}: {
  children: ReactNode;
  generator?: PathGenerator;
  repository?: TreeRepository;
}) {
const [state, dispatch] = useReducer(reducer, initialState);

  const { cloud, repo, cloudRepo, treeRef, aiEnabledRef, predictingRef } = useTreePersistence({
    state,
    dispatch,
    repository,
  });
  const [feedEvents, setFeedEvents] = useState<Record<string, IcsEvent[]>>({});
  useEffect(() => {
    fetchEnrichEnabled().then((enabled) => dispatch({ type: "setAiEnabled", enabled }));
  }, []);
  const urlFeeds = state.tree?.calendarFeeds?.filter((f) => f.url) ?? [];
  const urlFeedSig = urlFeeds.map((f) => `${f.id}|${f.url}`).join(",");
  useEffect(() => {
    let cancelled = false;
    const feeds = (treeRef.current?.calendarFeeds ?? []).filter((f) => f.url);
    if (!feeds.length) {
      setFeedEvents((cur) => (Object.keys(cur).length ? {} : cur));
      return;
    }
    void Promise.all(
      feeds.map(async (f) => ({ id: f.id, events: await fetchIcsEvents(f.url!) })),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, IcsEvent[]> = {};
      for (const r of results) next[r.id] = r.events;
      setFeedEvents(next);
    });
    return () => {
      cancelled = true;
    };
  }, [treeRef, urlFeedSig]);

  // 给日历叠加的只读事件：内联文件事件（feed.events）∪ url 订阅源代取的事件（feedEvents）。
  const importedEvents = useMemo<IcsEvent[]>(() => {
    const feeds = state.tree?.calendarFeeds ?? [];
    const out: IcsEvent[] = [];
    for (const f of feeds) {
      if (f.url) out.push(...(feedEvents[f.id] ?? []));
      else if (f.events) out.push(...f.events);
    }
    return out;
  }, [state.tree?.calendarFeeds, feedEvents]);

  // 持久化：tree 变化即写入。
  //   flag 关（默认）：同步写 localStorage，逐字与今天一致。
  //   flag 开 + 已登录：仍同步写本地（离线兜底 / 迁移源），并防抖写云端。
  //   flag 开 + 未登录：只写本地，与今天一致。
  // 防抖 timer：避免每次小改动都打云端；卸载/再次变更时清掉旧 timer。
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!(state.hydrated && state.tree)) return;
    const tree = state.tree;
    // 本地写入始终发生（flag 关时这是唯一存档；flag 开时作为离线兜底，无害）。
    repo().save(tree);
    if (!cloud.enabled || !cloud.userId) return; // flag 关 / 未登录：到此为止，与今天一致
    const cr = cloudRepo();
    if (!cr) return;
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(() => {
      // SupabaseRepository.save 自身吞错（不崩）；这里再兜一层。
      void cr.save(tree).catch(() => {});
    }, 800);
    return () => {
      if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    };
  }, [state.tree, state.hydrated, repo, cloud.enabled, cloud.userId, cloudRepo]);

  // 核心：先在内存里生成本地占位路径，等 AI 把这一批全部推演完，再一次性提交到
  // 树上（届时分支才画出来，并落在 AI 决定的分叉年龄）。AI 没接入/失败则用本地兜底，
  // 但仍保证动画至少播 MIN_PREDICT_MS，让"正在推演"有质感。
  const predictAndCommit = useCallback(
    async (
      workingTree: LifeTree,
      newPaths: LifePath[],
      context: "onboarding" | "branch",
    ): Promise<void> => {
      const labels = newPaths
        .filter((p) => p.kind === "choice")
        .map((p) => p.choiceLabel);
      dispatch({ type: "predictStart", labels, total: newPaths.length, context });

      const { profile, horizonYears } = workingTree;
      const enrichedById = new Map<string, LifePath>();
      const enrichOne = async (p: LifePath) => {
        let finalP = p;
        if (aiEnabledRef.current) {
          const result = await fetchEnrichment(workingTree, p);
          if (result) finalP = applyEnrichment(p, result, profile.age, horizonYears);
        }
        enrichedById.set(p.id, finalP);
        dispatch({ type: "predictTick" });
      };

      await Promise.all([
        Promise.all(newPaths.map(enrichOne)),
        delay(MIN_PREDICT_MS), // 动画下限：等真预测或这个时长，取较长者
      ]);

      const finalPaths = workingTree.paths.map((p) => enrichedById.get(p.id) ?? p);
      // 推演期间 UI 仍可编辑（选项字段/目标/任务/拍板…），这些都写进了更新的 treeRef。
      // 提交时读最新树、只整体替换 paths（已含新分支+润色），保留期间的并发编辑，不回退。
      // treeRef 为空（首次 onboarding）则退回 workingTree，行为不变。
      const cur = treeRef.current ?? workingTree;
      dispatch({
        type: "setTree",
        tree: { ...cur, paths: finalPaths, updatedAt: new Date().toISOString() },
      });
      dispatch({ type: "predictEnd" });
    },
    [aiEnabledRef, treeRef],
  );

  // 带上用户补充信息，重新推演某条已存在的路（原地替换，停留在详情页）。
  // 若重推的是"最可能"基准，顺带丢掉它的乐观/保守兄弟——下次切换时按新 forkAge 重生，
  // 免得与基准时间错位。
  const regenerateAndCommit = useCallback(
    async (pathId: string, note: string): Promise<void> => {
      const base = treeRef.current;
      if (!base) return;
      const target = base.paths.find((p) => p.id === pathId);
      if (!target) return;
      const noted: LifePath = { ...target, note: note.trim() || undefined };
      dispatch({ type: "predictStart", labels: [noted.choiceLabel], total: 1, context: "branch" });

      let finalP = noted;
      await Promise.all([
        (async () => {
          if (aiEnabledRef.current) {
            const result = await fetchEnrichment(base, noted);
            if (result) finalP = applyEnrichment(noted, result, base.profile.age, base.horizonYears);
          }
          dispatch({ type: "predictTick" });
        })(),
        delay(MIN_PREDICT_MS),
      ]);

      const cur = treeRef.current ?? base;
      const dropSiblings = finalP.scenario === "likely" && finalP.parentId == null;
      const paths = cur.paths
        .filter(
          (p) =>
            !(
              dropSiblings &&
              p.id !== finalP.id &&
              p.choiceLabel === finalP.choiceLabel &&
              p.parentId === finalP.parentId &&
              p.scenario !== "likely"
            ),
        )
        .map((p) => (p.id === finalP.id ? finalP : p));
      dispatch({ type: "patchTree", tree: { ...cur, paths, updatedAt: new Date().toISOString() } });
      dispatch({ type: "predictEnd" });
    },
    [aiEnabledRef, treeRef],
  );

  const api = useAppApi({
    state,
    dispatch,
    generator,
    repo,
    cloudRepo,
    treeRef,
    predictingRef,
    predictAndCommit,
    regenerateAndCommit,
    importedEvents,
  });


  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
