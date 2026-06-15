// 确定性伪随机 —— 不使用 Math.random / Date.now，保证同输入同输出（刷新稳定、可保存复现）。

// xfnv1a：把字符串散列成一个 32 位种子
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  // 额外混合，减少相邻字符串的相关性
  h += h << 13;
  h ^= h >>> 7;
  h += h << 3;
  h ^= h >>> 17;
  h += h << 5;
  return h >>> 0;
}

// mulberry32：给定数字种子，返回 [0,1) 的确定性随机函数
export function makeRng(seed: string | number): () => number {
  let a = (typeof seed === "string" ? hashSeed(seed) : seed) >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 便捷：返回 [min,max] 区间内的随机数
export function rngRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

// 便捷：从数组里确定性挑一个
export function rngPick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}
