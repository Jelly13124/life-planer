import type { LifePath, LifeTree, Profile, Scenario } from "./types";
import type { PathGenerator } from "./generator/types";
import { hashSeed } from "./seed";
import { inferForkAge } from "./forkTiming";

export interface AddPathOptions {
  parentId?: string | null; // 父分支 id；不传 = 从"现在"分叉
  forkAge?: number; // 从哪一年分叉；不传 = profile.age
  scenario?: Scenario; // 走向；不传 = likely
}

export const DEFAULT_HORIZON_YEARS = 15;

// 纯函数：不使用 Date.now —— 时间戳由副作用层 (state) 注入。
export function createTree(
  profile: Profile,
  generator: PathGenerator,
  now: string,
  horizonYears: number = DEFAULT_HORIZON_YEARS,
): LifeTree {
  const id = `tree-${hashSeed(`${profile.name}|${now}`)}`;

  const statusQuo: LifePath = generator.generate({
    profile,
    choiceLabel: "",
    kind: "status-quo",
    horizonYears,
    index: 0,
  });

  const paths: LifePath[] = [statusQuo];

  // 用当前岔路生成第一条 choice 路径（若用户填了）。
  // 分叉年龄按选择推测——它从现实的人生时间点长出，而不是都挤在"现在"。
  const crossroad = profile.crossroad.trim();
  if (crossroad) {
    paths.push(
      generator.generate({
        profile,
        choiceLabel: crossroad,
        kind: "choice",
        horizonYears,
        index: 1,
        forkAge: inferForkAge(profile, crossroad),
      }),
    );
  }

  return {
    id,
    profile,
    horizonYears,
    paths,
    decisions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addPath(
  tree: LifeTree,
  choiceLabel: string,
  generator: PathGenerator,
  now: string,
  opts: AddPathOptions = {},
): LifeTree {
  const label = choiceLabel.trim();
  if (!label) return tree;
  const isRoot = (opts.parentId ?? null) === null;
  // 根分支：没指定就按选择推测分叉年龄（"两年后才辞职"）。
  // 子分支：分叉年龄由点击的节点决定，没传则退回当前年龄。
  const forkAge =
    opts.forkAge ?? (isRoot ? inferForkAge(tree.profile, label) : tree.profile.age);
  const path = generator.generate({
    profile: tree.profile,
    choiceLabel: label,
    kind: "choice",
    horizonYears: tree.horizonYears,
    index: tree.paths.length,
    parentId: opts.parentId ?? null,
    forkAge,
    scenario: opts.scenario ?? "likely",
  });
  return { ...tree, paths: [...tree.paths, path], updatedAt: now };
}

// 生成某条已有路径的一个走向变体（乐观/保守），作为兄弟分支挂在同一父/分叉处。
export function addScenarioVariant(
  tree: LifeTree,
  basePathId: string,
  scenario: Scenario,
  generator: PathGenerator,
  now: string,
): LifeTree {
  const base = tree.paths.find((p) => p.id === basePathId);
  if (!base) return tree;
  // 已有同一选择+同一走向+同一父，则不重复生成
  const exists = tree.paths.some(
    (p) =>
      p.choiceLabel === base.choiceLabel &&
      p.parentId === base.parentId &&
      p.forkAge === base.forkAge &&
      p.scenario === scenario,
  );
  if (exists) return tree;
  const path = generator.generate({
    profile: tree.profile,
    choiceLabel: base.choiceLabel,
    kind: base.kind,
    horizonYears: tree.horizonYears,
    index: tree.paths.length,
    parentId: base.parentId,
    forkAge: base.forkAge,
    scenario,
  });
  return { ...tree, paths: [...tree.paths, path], updatedAt: now };
}

// 删除一条路径，并级联删除其所有后代分支（不可删除"维持现状"）。
export function removePath(tree: LifeTree, pathId: string, now: string): LifeTree {
  const target = tree.paths.find((p) => p.id === pathId);
  if (!target || target.kind === "status-quo") return tree;

  const toRemove = new Set<string>([pathId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of tree.paths) {
      if (p.parentId && toRemove.has(p.parentId) && !toRemove.has(p.id)) {
        toRemove.add(p.id);
        grew = true;
      }
    }
  }

  return {
    ...tree,
    paths: tree.paths.filter((p) => !toRemove.has(p.id)),
    decisions: tree.decisions.filter((d) => !toRemove.has(d.pathId)),
    updatedAt: now,
  };
}
