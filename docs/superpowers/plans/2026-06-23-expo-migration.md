# Expo / React Native 迁移计划 (2026-06-23)

目标:把 Life Planner 移成原生 iOS/Android(Expo + React Native),**不丢已建的纯领域核心**,**不破坏现有 web**。多周工程,分阶段,每阶段可验证。

## 架构(已与用户敲定)
- **现有 Next.js 留在仓库根目录,原样不动**:既是 web 客户端,又**部署成 API 后端**(RN 调它的 `/api/*`:enrich/chat/analyze-choice/decompose-goal/plan-short-goal/arrange-day/today-plan/goals/...)。复用全部路由 + 预测 prompt。
- **新 Expo app 放 `mobile/`**(RN client)。
- **共享纯领域核心**:`src/domain/*`(types/goals/daily/calendar/feasibility/quickParse/ics/migrate/profile/schedule/habits/areas/insights/weekly/guide/reminders/planShort/choices + 测试)无 DOM/Next 依赖,**两端共用同一份**——Metro/babel 解析到根 `src/domain`,**不复制、不搬动**(web 的 `@/domain` 别名保持不变)。
- **同步**:Supabase JS 在 RN 端可用(待用户接新号)。
- **状态**:AppContext/reducer 逻辑可移;持久化 localStorage→AsyncStorage;API base URL 走 env(开发指向本机/部署后指向线上)。
- **不可**:RN 直连 DeepSeek(暴露 key)——一律走后端。

## 阶段
1. **脚手架 + 接通核心(本阶段)**:`mobile/` 起 Expo(TS, blank);装 NativeWind + react-native-svg + reanimated + gesture-handler + @react-native-async-storage + @supabase/supabase-js;配 Metro `watchFolders`/`resolver` 让 `mobile` 能 import 根 `src/domain`;一个最小屏渲染来自 domain 的东西(如 `createTree` 后列出 5 个领域 / 跑通一次 `/api/enrich` 调用到本机 Next),**证明 domain + API 管线通**。web 不动、仍全绿。
2. **状态层移植 + 第一个真实屏**:把 AppContext 关键部分移到 RN(AsyncStorage repo + API base URL client);先做「目标」列表或「人生树(只读)」一屏,数据走共享 domain + 调线上/本机 API。
3. **逐屏重建 UI(RN)**:规划(领域→长期→短期→任务/习惯/指标)、日历(年/月/日 + 即将到来)、人生树/预测(react-native-svg + reanimated)、选择面板、今日/提醒。导航用 expo-router。主题 = NativeWind 复刻苹果白。拖拽 = gesture-handler/reanimated。
4. **同步 + 鉴权(RN)**:Supabase magic-link/OAuth + 云同步(复用 domain 的 normalize/migrate)。
5. **后端部署 + 打包**:把根 Next.js 部署成 API(Vercel 等),mobile 指向它;EAS build 出 iOS/Android。

## 不动 / 护栏
- 根 Next.js(web + API)零改动,`npx tsc/vitest/next build` 全程绿。
- 纯 domain 是单一真相源,两端共享,不复制。
- 每阶段独立提交、可回退。

## 诚实风险
UI 几乎全量重写(几周);Expo/RN + Windows 脚手架可能有环境摩擦,逐步排。domain/状态/后端复用把工作量压到"只重写 UI 层"。
