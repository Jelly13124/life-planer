# 动机闭环可见 × 动态可行度 (Route A ②, 2026-06-23)

分支 `feat/goal-planning-mainline`。Route A 的留存钩子:把"日常行动"和"那个未来"肉眼可见地缝起来。核心机制——**可行度会动**:AI 给起步分,用户完成这条路上的目标 → 可行度上涨。

## 机制(诚实、克制)
- 每条 choice 路有 `feasibility`(AI/粗估起步分,已实现)。
- **有效可行度 = 起步分 + 你的行动加成**:
  - 关联目标 = 活跃且 `goal.pathId === path.id` 的长期目标。
  - `pathProgress` = 这些目标 goalProgress 的平均(0–1)。
  - `bump = round(pathProgress * BUMP_MAX)`,BUMP_MAX = 30。
  - `effective = min(95, baseline + bump)`(封顶 95,绝不显示 100%——诚实)。
- 含义:把一个目标挂到这条路 → 你越完成它,这条路"对你"越够得着。**不是宇宙概率,是"你的进度在改变可行度"**,文案要说清。

## 纯函数(domain,带测试)
- `effectiveFeasibility(tree, path): { value, baseline, bump, pathProgress }`(path.feasibility 未定义 → 返回 null,UI 不显示)。
- `linkedGoals(tree, pathId)` / `pathProgress(tree, pathId)`。
- 纯、确定性、无 Date.now/Math.random。

## 显示(让闭环可见)
- **PathDetail**:可行度行改成显示 effective:`现实可行度 · 约 {value}%`;当 bump>0 加一行 `起步 {baseline}% · 你的行动 +{bump}%`(强调是你做出来的);保留"AI 粗估,非精确概率"免责。若该路还没挂目标,提示"把一个目标挂到这条路,完成它,可行度会涨"。
- **LifeMap 徽标**:显示 effective(选中/悬停时,沿用现状)。
- **首页 CalendarPlannerScreen**:已有"长期目标"列(带 pathId)。给每个挂了路的目标加一句:`这条路可行度 {value}%`,且当 bump>0 标 `+{bump}%`(绿色,正反馈)。让用户在做事的地方就看到"我的行动把未来推近了"。
- **里程碑 → 和未来的自己**:已存在(完成目标 → 🏆 行 → 和未来的你说一声)。确认在并保留。

## 不动
- 不改 enrich prompt / feasibility 的 AI 估法(上一刀已定);只是在其上叠加"行动加成"的纯计算 + 显示。
- 不改目标模型 / 日历 / 提醒。"你在这里"标记沿分支前进(branchPositionAge/goalProgress)已存在,保留。

## 验收
挂一个长期目标到某条路 → 完成它的任务 → PathDetail 与首页的可行度从起步分往上涨、显示 `+{bump}%`;完成整目标 → 庆祝 + 和未来对话;status-quo / 未挂目标的路不显示加成。tsc/test/build 全绿。

## 诚实风险
"可行度随进度涨"是产品化的动机设计,不是客观真理——靠封顶 95 + "你的行动 +X%" 的措辞(明说是你推动的,不是命运)守住不浮夸。
