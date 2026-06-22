import { describe, expect, it } from "vitest";
import {
  addOption,
  createChoice,
  decideChoice,
  findChoiceByOption,
  linkOptionPath,
  removeChoice,
  removeOption,
  reopenChoice,
  suggestOption,
  updateOption,
} from "../choices";
import type { Choice, ChoiceOption, LifeTree, Profile } from "../types";

const NOW = "2026-06-20T00:00:00.000Z";
const LATER = "2026-06-21T08:00:00.000Z";

// 最小可用 tree：只填 choices 关心的字段；其余用空壳满足类型。
function makeTree(choices: Choice[] = []): LifeTree {
  return {
    id: "tree-test",
    profile: {} as Profile,
    horizonYears: 15,
    paths: [],
    decisions: [],
    goals: [],
    choices,
    activity: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const option = (over: Partial<ChoiceOption> = {}): ChoiceOption => ({
  id: "o1",
  label: "选项",
  pros: "",
  cons: "",
  cost: "",
  reversibility: "two-way",
  gut: 3,
  pathId: null,
  ...over,
});

const choice = (over: Partial<Choice> = {}): Choice => ({
  id: "c1",
  question: "去大厂还是创业？",
  createdAt: NOW,
  options: [],
  chosenOptionId: null,
  ...over,
});

describe("createChoice", () => {
  it("appends a choice with fields set and createdAt=now", () => {
    const tree = makeTree();
    const { tree: next, id } = createChoice(tree, "  去大厂还是创业？  ", NOW);
    expect(next.choices).toHaveLength(1);
    const c = next.choices[0];
    expect(c.id).toBe(id);
    expect(id).not.toBe("");
    expect(c.question).toBe("去大厂还是创业？"); // trimmed
    expect(c.createdAt).toBe(NOW);
    expect(c.options).toEqual([]);
    expect(c.chosenOptionId).toBeNull();
    expect(c.decidedAt).toBeUndefined();
  });

  it("is deterministic (same inputs → same id) and unique per index", () => {
    const a = createChoice(makeTree(), "Q", NOW).id;
    const b = createChoice(makeTree(), "Q", NOW).id;
    expect(a).toBe(b);
    // second choice on same tree+now+question gets a different id (index salt)
    const t1 = createChoice(makeTree(), "Q", NOW);
    const t2 = createChoice(t1.tree, "Q", NOW);
    expect(t2.id).not.toBe(t1.id);
  });

  it("does not mutate the original tree (immutability)", () => {
    const tree = makeTree();
    createChoice(tree, "Q", NOW);
    expect(tree.choices).toHaveLength(0);
  });
});

describe("addOption", () => {
  it("appends an option with defaults (reversibility two-way, gut 3, pathId null)", () => {
    const base = createChoice(makeTree(), "Q", NOW);
    const { tree, id } = addOption(base.tree, base.id, "  去大厂  ", NOW);
    const opts = tree.choices[0].options;
    expect(opts).toHaveLength(1);
    const o = opts[0];
    expect(o.id).toBe(id);
    expect(id).not.toBe("");
    expect(o.label).toBe("去大厂");
    expect(o.pros).toBe("");
    expect(o.cons).toBe("");
    expect(o.cost).toBe("");
    expect(o.reversibility).toBe("two-way");
    expect(o.gut).toBe(3);
    expect(o.pathId).toBeNull();
  });

  it("returns {tree unchanged, id:''} when choiceId is missing", () => {
    const tree = makeTree([choice()]);
    const { tree: next, id } = addOption(tree, "nope", "x", NOW);
    expect(id).toBe("");
    expect(next.choices[0].options).toHaveLength(0);
  });
});

describe("updateOption", () => {
  it("shallow-merges patch and never overwrites id; locates across multiple choices", () => {
    const tree = makeTree([
      choice({ id: "c1", options: [option({ id: "oA", label: "A" })] }),
      choice({ id: "c2", options: [option({ id: "oB", label: "B" })] }),
    ]);
    const next = updateOption(tree, "oB", { id: "HACK", label: "B2", pros: "好处" });
    const o = next.choices[1].options[0];
    expect(o.id).toBe("oB"); // id preserved
    expect(o.label).toBe("B2");
    expect(o.pros).toBe("好处");
    // sibling untouched
    expect(next.choices[0].options[0].label).toBe("A");
  });

  it("clamps gut to [1,5] when present", () => {
    const tree = makeTree([choice({ options: [option({ id: "o1" })] })]);
    expect(updateOption(tree, "o1", { gut: 9 }).choices[0].options[0].gut).toBe(5);
    expect(updateOption(tree, "o1", { gut: 0 }).choices[0].options[0].gut).toBe(1);
    expect(updateOption(tree, "o1", { gut: 4 }).choices[0].options[0].gut).toBe(4);
  });
});

describe("removeOption", () => {
  it("removes the option from its choice", () => {
    const tree = makeTree([
      choice({ options: [option({ id: "o1" }), option({ id: "o2" })] }),
    ]);
    const next = removeOption(tree, "o1");
    expect(next.choices[0].options.map((o) => o.id)).toEqual(["o2"]);
  });

  it("clears chosenOptionId + decidedAt if the removed option was chosen", () => {
    const tree = makeTree([
      choice({
        options: [option({ id: "o1" }), option({ id: "o2" })],
        chosenOptionId: "o1",
        decidedAt: LATER,
      }),
    ]);
    const next = removeOption(tree, "o1");
    expect(next.choices[0].chosenOptionId).toBeNull();
    expect(next.choices[0].decidedAt).toBeUndefined();
  });

  it("leaves chosenOptionId intact if a different option was removed", () => {
    const tree = makeTree([
      choice({
        options: [option({ id: "o1" }), option({ id: "o2" })],
        chosenOptionId: "o2",
        decidedAt: LATER,
      }),
    ]);
    const next = removeOption(tree, "o1");
    expect(next.choices[0].chosenOptionId).toBe("o2");
    expect(next.choices[0].decidedAt).toBe(LATER);
  });
});

describe("decideChoice", () => {
  it("sets chosenOptionId + decidedAt when the option belongs to the choice", () => {
    const tree = makeTree([
      choice({ id: "c1", options: [option({ id: "o1" }), option({ id: "o2" })] }),
    ]);
    const next = decideChoice(tree, "c1", "o2", LATER);
    expect(next.choices[0].chosenOptionId).toBe("o2");
    expect(next.choices[0].decidedAt).toBe(LATER);
  });

  it("ignores an optionId that belongs to a different choice", () => {
    const tree = makeTree([
      choice({ id: "c1", options: [option({ id: "o1" })] }),
      choice({ id: "c2", options: [option({ id: "o2" })] }),
    ]);
    const next = decideChoice(tree, "c1", "o2", LATER);
    expect(next.choices[0].chosenOptionId).toBeNull();
    expect(next.choices[0].decidedAt).toBeUndefined();
  });
});

describe("reopenChoice", () => {
  it("clears chosenOptionId and removes decidedAt", () => {
    const tree = makeTree([
      choice({ options: [option({ id: "o1" })], chosenOptionId: "o1", decidedAt: LATER }),
    ]);
    const next = reopenChoice(tree, "c1");
    expect(next.choices[0].chosenOptionId).toBeNull();
    expect(next.choices[0].decidedAt).toBeUndefined();
  });
});

describe("removeChoice", () => {
  it("drops the whole choice", () => {
    const tree = makeTree([choice({ id: "c1" }), choice({ id: "c2" })]);
    const next = removeChoice(tree, "c1");
    expect(next.choices.map((c) => c.id)).toEqual(["c2"]);
  });
});

describe("linkOptionPath", () => {
  it("sets that option's pathId", () => {
    const tree = makeTree([
      choice({ id: "c1", options: [option({ id: "o1" })] }),
      choice({ id: "c2", options: [option({ id: "o2" })] }),
    ]);
    const next = linkOptionPath(tree, "o2", "path-123");
    expect(next.choices[1].options[0].pathId).toBe("path-123");
    expect(next.choices[0].options[0].pathId).toBeNull();
  });
});

describe("findChoiceByOption", () => {
  it("returns the {choice, option} pair", () => {
    const tree = makeTree([
      choice({ id: "c1", options: [option({ id: "o1" })] }),
      choice({ id: "c2", options: [option({ id: "o2", label: "B" })] }),
    ]);
    const found = findChoiceByOption(tree, "o2");
    expect(found?.choice.id).toBe("c2");
    expect(found?.option.label).toBe("B");
  });

  it("returns null when the option is not found", () => {
    const tree = makeTree([choice({ options: [option({ id: "o1" })] })]);
    expect(findChoiceByOption(tree, "nope")).toBeNull();
  });
});

describe("suggestOption", () => {
  it("returns null when there are no options", () => {
    expect(suggestOption(choice({ options: [] }))).toBeNull();
  });

  it("picks the option with the highest gut", () => {
    const c = choice({
      options: [
        option({ id: "lo", gut: 2 }),
        option({ id: "hi", gut: 5 }),
        option({ id: "mid", gut: 3 }),
      ],
    });
    expect(suggestOption(c)).toBe("hi");
  });

  it("tiebreaks equal gut by preferring two-way reversibility", () => {
    const c = choice({
      options: [
        option({ id: "oneway", gut: 5, reversibility: "one-way" }),
        option({ id: "twoway", gut: 5, reversibility: "two-way" }),
      ],
    });
    expect(suggestOption(c)).toBe("twoway");
  });

  it("further tiebreaks (same gut + same reversibility) by fewer cons lines", () => {
    const c = choice({
      options: [
        option({ id: "manyCons", gut: 5, reversibility: "two-way", cons: "a\nb\n\nc" }),
        option({ id: "fewCons", gut: 5, reversibility: "two-way", cons: "a" }),
      ],
    });
    expect(suggestOption(c)).toBe("fewCons");
  });

  it("is deterministic and stable for equal options (first wins)", () => {
    const c = choice({
      options: [
        option({ id: "first", gut: 4, reversibility: "two-way", cons: "x" }),
        option({ id: "second", gut: 4, reversibility: "two-way", cons: "x" }),
      ],
    });
    expect(suggestOption(c)).toBe("first");
  });
});
