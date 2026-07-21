import { defaultExclude, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    // 默认 node 环境（领域逻辑是纯 TS）。组件测试用 // @vitest-environment jsdom 文件头切换。
    environment: "node",
    exclude: [...defaultExclude, "**/tmp/**", "**/output/**"],
    globals: true,
    pool: "threads",
  },
  resolve: {
    // Order matters: more specific aliases first so "@/domain/*" (now living in
    // the workspace package) wins over the generic "@/*" web-app alias.
    alias: [
      {
        find: /^@\/domain\//,
        replacement: fileURLToPath(new URL("./packages/core/src/", import.meta.url)),
      },
      {
        find: /^@lifeplanner\/core$/,
        replacement: fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      },
      {
        find: /^@lifeplanner\/core\//,
        replacement: fileURLToPath(new URL("./packages/core/src/", import.meta.url)),
      },
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL("./src/", import.meta.url)),
      },
    ],
  },
});
