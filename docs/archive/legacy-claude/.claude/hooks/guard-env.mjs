#!/usr/bin/env node
// PreToolUse 钩子：拦截对 .env* 文件的读写，保护密钥（DeepSeek key 在 .env.local）。
// fail-open：只有明确命中 .env 才拦，其它一律放行，避免误伤。
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(raw || "{}");
    const input = data.tool_input || {};
    const p = input.file_path || input.path || "";
    if (/(?:^|[\\/])\.env(\.[A-Za-z0-9_]+)?$/i.test(p) || /(?:^|[\\/])\.env(?:[\\/.]|$)/i.test(p)) {
      console.error(
        `🛑 已拦截对受保护文件的操作：${p}\n.env* 含密钥，请手动编辑 .env.local，不要通过工具读写。`,
      );
      process.exit(2); // 阻止该工具调用
    }
  } catch {
    // 解析失败也放行
  }
  process.exit(0);
});
