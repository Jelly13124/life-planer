# 手机端接后端（AI 分支 / 对话 / AI 建议目标）

手机端的 AI 功能走根 Next.js 的 `/api/*`（DeepSeek）。`mobile/src/lib/api.ts`：
- env `EXPO_PUBLIC_API_BASE_URL` 优先；
- 没设时 **dev 自动回退**到 Metro 同一台主机的 `:3000`（`Constants.expoConfig.hostUri` 取主机）；
- 都没有 → 离线降级（分支用本地生成器、对话提示需连后端），不报错。
- `DEEPSEEK_API_KEY` 只在根 `.env.local`（服务端）；手机端绝不直连 DeepSeek。

## 本机开发（模拟器 / 真机）
1. 启动后端：仓库根 `npm run dev`（:3000，读 `.env.local` 的 DeepSeek key）。`GET http://localhost:3000/api/enrich` 返回 `{"enabled":true}` 即 AI 已启用。
2. 启动 Metro：`cd mobile && npx expo start`。
3. **安卓模拟器**（最稳）：`adb reverse tcp:3000 tcp:3000` + `adb reverse tcp:8081 tcp:8081`，应用里用 `exp://127.0.0.1:8081` 打开。api.ts 会自动用 `http://127.0.0.1:3000` 当后端。
4. **真机（同一 WiFi）**：手机扫 Expo Go 的码；api.ts 自动用 `http://<电脑局域网IP>:3000`。需电脑防火墙放行 3000。
   - 若公司网络隔离导致连不上，回退用 `adb reverse`（真机插 USB 也可）或部署到公网（见下）。
5. 验证：人生树加一条选择 → "AI 推演中…" → 卡片换成真 AI 故事 + 现实可行度；服务器日志出现 `POST /api/enrich 200`。和未来的自己对话同理走 `/api/chat`。

## 想固定指定后端（覆盖自动回退）
在 `mobile/.env`（自己手建，已 gitignore）写一行：
```
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000
```
改 env 后要重启 Metro（`EXPO_PUBLIC_*` 在打包时内联）。

## 让它「在哪都能用」= 部署后端到公网（生产步骤）
本机方案只在「电脑开着 + 同网/转发」时有效。要真正随时可用：
1. 把根 Next.js 部署到 Vercel（你登录操作）。环境变量配 `DEEPSEEK_API_KEY`（+ 如用云同步再加 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`）。
2. `mobile/.env` 里 `EXPO_PUBLIC_API_BASE_URL=https://<你的vercel域名>`。
3. 重新打包/EAS build，手机端就随时连公网后端，不再依赖你的电脑。

> 已验证（2026-06-24，模拟器）：`adb reverse` + `127.0.0.1:3000`，加分支触发 `POST /api/enrich 200 in 17s`，返回真 AI 预测。
