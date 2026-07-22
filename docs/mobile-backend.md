# 手机端连接网页 API 与 Supabase

手机端把根 Next.js 部署当作 API 后端。生产地址已经固定为：

```text
https://life-planer-opal.vercel.app
```

`mobile/eas.json` 的 preview/production profile 均配置了 `EXPO_PUBLIC_API_BASE_URL`。EAS Production 环境还存在：

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

变量值不进入仓库。

## 本地开发

从仓库根目录启动 API：

```bash
npm run dev
```

再启动 Mobile：

```bash
npm run start --workspace mobile
```

`mobile/src/lib/api.ts` 的地址优先级：

1. `EXPO_PUBLIC_API_BASE_URL`
2. 开发模式下 Metro 主机的 `:3000`
3. 无可用后端时返回连接失败，让界面保留既有内容并提供重试

安卓模拟器可使用：

```bash
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
```

真机需要与电脑同网，并允许防火墙访问 `3000`/`8081`；也可以临时在 `mobile/.env` 设置局域网地址。`EXPO_PUBLIC_*` 会打入 bundle，修改后必须重启 Metro 或重新构建。

## 服务端变量

AI 密钥只配置在 Vercel/根 `.env.local`：

- `DEEPSEEK_API_KEY`
- 可选 `LIFEPLANNER_MODEL`

手机绝不能直连 DeepSeek。内容生成失败时不伪造新的预测或目标，客户端显示重试；本地几何、进度和已经保存的内容仍可使用。

账户删除和匿名统计还需要 Vercel 的服务端 `SUPABASE_SECRET_KEY`。完整列表见 `supabase-setup.md`。

## 验证

- `GET /api/enrich` 返回 `{"enabled":true}` 表示服务端 AI 已启用。
- 手机触发预测后，Vercel/本地日志应出现对应 `/api/*` 请求。
- 未带 token 请求生产 `DELETE /api/account` 应返回 `401`，不能返回 `500/503`。
- Supabase 登录、跨设备同步和有效 token 删除需要真机账号做一次端到端验收。
