import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    // 默认 node 环境（领域逻辑是纯 TS）。组件测试用 // @vitest-environment jsdom 文件头切换。
    environment: "node",
    globals: true,
    pool: "threads",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
