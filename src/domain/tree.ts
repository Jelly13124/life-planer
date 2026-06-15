import type { LifePath, LifeTree, Profile } from "./types";
import type { PathGenerator } from "./generator/types";
import { hashSeed } from "./seed";

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

  // 用当前岔路生成第一条 choice 路径（若用户填了）
  const crossroad = profile.crossroad.trim();
  if (crossroad) {
    paths.push(
      generator.generate({
        profile,
        choiceLabel: crossroad,
        kind: "choice",
        horizonYears,
        index: 1,
      }),
    );
  }

  return {
    id,
    profile,
    horizonYears,
    paths,
    createdAt: now,
    updatedAt: now,
  };
}

export function addPath(
  tree: LifeTree,
  choiceLabel: string,
  generator: PathGenerator,
  now: string,
): LifeTree {
  const label = choiceLabel.trim();
  if (!label) return tree;
  const path = generator.generate({
    profile: tree.profile,
    choiceLabel: label,
    kind: "choice",
    horizonYears: tree.horizonYears,
    index: tree.paths.length,
  });
  return { ...tree, paths: [...tree.paths, path], updatedAt: now };
}

export function removePath(tree: LifeTree, pathId: string, now: string): LifeTree {
  const target = tree.paths.find((p) => p.id === pathId);
  if (!target || target.kind === "status-quo") return tree; // 不可删除"维持现状"
  return {
    ...tree,
    paths: tree.paths.filter((p) => p.id !== pathId),
    updatedAt: now,
  };
}
