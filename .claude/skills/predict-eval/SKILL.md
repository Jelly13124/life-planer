---
name: predict-eval
description: Spot-check AI prediction quality — run a sample profile through /api/enrich and grade the result against the PRD (real anchors, density/depth, multi-dimension, no contradiction, no cliché). Use when you want to verify "is the prediction real and detailed enough?" or debug why it feels fake.
---

# Predict-Eval

Quick, repeatable quality check of the life-prediction output.

## Steps

1. **Make sure the dev server is up** on port 3000:
   - Check: `curl -s -o NUL -w "%{http_code}" http://localhost:3000` (200 = up).
   - If not, start it: `npm run dev` (background) and confirm `{"enabled":true}` from `curl -s http://localhost:3000/api/enrich` (means a DeepSeek key is loaded in `.env.local`).

2. **Write a clean-UTF-8 request body** to `.superpowers/eval-body.json` using the Write tool — NEVER inline Chinese in a shell `-d` argument (the shell mangles it to `??`). Shape:
   ```json
   {"profile":{"name":"小雨","age":26,"education":"master","major":"计算机","occupation":"软件工程师","salary":"20to50","hasSideHustle":false,"sideHustle":"","hobbies":"健身","relationship":"dating","location":"美国纽约","status":"读完研，H1B工作签","snapshot":"在科技公司做后端","areas":{"career":65,"wealth":60,"relationships":60,"health":70,"growth":60}},"startAge":26,"horizonYears":15,"choiceLabel":"跳槽去一线大厂","kind":"choice","curve":"rise-gentle"}
   ```

3. **Call the API:**
   ```bash
   curl -s -X POST http://localhost:3000/api/enrich -H "content-type: application/json" --data-binary @.superpowers/eval-body.json
   ```
   (Pipe through `python -c` with `PYTHONUTF8=1` for readable Chinese, or just read the raw JSON.)

4. **Grade against `docs/PRD-prediction-experience.md` §7** — for the result, check each and quote evidence:
   - Future-only (all ages > current) & no contradiction with known facts (visa, finished grad school).
   - Real anchors: true visa milestones, real salary bands, real ladder/cities — not vague ("进了大厂").
   - Density/depth: ≥6 nodes, each 3–5 sentences with a person/number/inner detail.
   - Multi-dimension: career + ≥3 of finance/relationships/health/housing/identity; identity+finance present.
   - Believable, no 爽文.

5. **Report** a pass/fail scorecard + the top fixes. For a deeper review, hand the output to the `prediction-quality-reviewer` subagent.

## Notes
- Switch model for a run by editing `LIFEPLANNER_MODEL` in `.env.local` (`deepseek-chat` fast/cheap, `deepseek-reasoner` slower/more faithful) and restarting `npm run dev`.
- Clean up `.superpowers/eval-body.json` when done (it's gitignored anyway).
