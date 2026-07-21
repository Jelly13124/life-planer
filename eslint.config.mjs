import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "output/**",
    "build/**",
    "tmp/**",
    "next-env.d.ts",
  ]),
  // 领域层纯函数铁律：packages/core/** 不得取当前时间/随机数（time 由 state 层注入）。
  // 只禁不纯的形式——无参 new Date()/Date.now()/Math.random()；new Date(注入值) 仍允许。
  // 编辑后由 .claude/hooks/check-edit.mjs 自动执行；测试目录豁免。
  {
    files: ["packages/core/**/*.{ts,tsx}"],
    ignores: ["packages/core/**/__tests__/**", "packages/core/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            "domain 层禁用无参 new Date()（取当前时间不纯）。请由 state 层注入 now/today（如 new Date(iso)）。",
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "domain 层禁用 Date.now()（不纯）。请由 state 层注入时间。",
        },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: "domain 层禁用 Math.random()（不纯）。请用 seed.ts 的种子化随机。",
        },
      ],
    },
  },
]);

export default eslintConfig;
