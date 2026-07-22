#!/usr/bin/env node
// PostToolUse 钩子：编辑 src 下的 .ts/.tsx/.js/.jsx 后，对该文件跑一次 ESLint，
// 当场抓出语法/解析错误（比如中文字符串里夹了英文引号导致构建挂）和 lint 错误。
// 只在 eslint 报“错误(status=1)”时拦下；eslint 自身崩溃(status=2)则放行，避免误伤。
import { execSync } from "node:child_process";

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let p = "";
  try {
    p = JSON.parse(raw || "{}").tool_input?.file_path || "";
  } catch {
    process.exit(0);
  }
  // 只检查源码（src/** 与 packages/**，后者含搬走的 domain），跳过 md/json/css/配置/脚本
  if (!/[\\/](src|packages)[\\/].*\.(ts|tsx|js|jsx)$/.test(p)) process.exit(0);

  try {
    execSync(`npx eslint "${p}" --quiet`, { stdio: "pipe" });
    process.exit(0);
  } catch (e) {
    if (e && e.status === 1) {
      const out =
        (e.stdout ? e.stdout.toString() : "") + (e.stderr ? e.stderr.toString() : "");
      console.error(
        "⚠️ ESLint 在刚改的文件里发现问题（含语法/解析错误，例如中文串里夹了英文引号）：\n" +
          out.slice(0, 4000),
      );
      process.exit(2); // 把问题反馈给 Claude
    }
    process.exit(0); // eslint 配置/崩溃等非 lint 错误，放行
  }
});
