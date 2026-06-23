# 六个核心差距 — 过夜修复计划 (2026-06-23)

> /goal: 按过夜习惯修六个核心问题;需要用户凭据/账号的留到早上,今晚把能无人值守做的都做完。每阶段 tsc+test+build 绿 + 提交。路线 A/B 未定,但本计划全是两条路都需要的地基,故先做。

六个差距(来自竞品刨析):捕捉、AI 排程、提醒/通知、接真实日历、云同步、移动/离线。

## 今晚做(无需用户凭据,自包含)
- **P1 快速捕捉 + 本地自然语言解析**:纯 `parseQuickInput(text, today)`(今天/明天/后天/周一…/每天/每周X/HH点/HH:MM/#标签 → {text,scheduledDate?,startTime?,repeat?,repeatWeekday?,tags?,kind})+ 测试;`quickAdd(text)` 建散装任务/日常;日历首页 + AppShell 顶部快速添加条。补回"秒记"。
- **P2 AI 规划这一段 + 更强本地排程**:`/api/plan-short-goal`(DeepSeek + 离线兜底 + 限流):短期目标 + 其任务/习惯 + 时间窗 + 作息 → 在窗口内按合理频率排(不填满);离线兜底=均匀铺到窗口内 N 天 + 习惯定 weekday。PlanScreen 短期目标卡「AI 规划这一段」预览→应用。
- **P3 提醒 + 通知 + Service Worker + PWA**:`public/sw.js`(离线缓存 + 通知)+ 注册;Notification 授权 UI;纯 `dueReminders(tree, now)`(今日/即将/逾期)+ 应用内"今日提醒";开着时到点用 Notification API 提醒当天有 startTime 的事;PWA 可安装 + 离线。(真离线推送需 VAPID+后端 → 早上。)
- **P4 ICS 日历导入(只读,无 OAuth)**:纯 ICS 解析 + `/api/ics?url=`(服务端代取,避 CORS,仅 https)+ tree 存订阅源/事件 + 月/日/即将到来 上只读叠加真实日历事件。给"接真实日历"一个不需要 OAuth 的真实版本。

## 今晚写代码、早上由你接(需凭据/账号)
- **P5 云同步 + 登录**:接 SupabaseRepository + 鉴权 UI + 本地↔云迁移 + AppContext 异步,**全部在 `isSupabaseCloudEnabled` flag 后**(默认关,不影响现有 localStorage)。早上你加 `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` + 跑建表 SQL 即可开。
- **早上清单(需你)**:① 填 Supabase 凭据 + 跑 schema → 开同步;② Google 日历双向(OAuth client id/secret);③ 真 Web Push(VAPID 密钥 + 后端);④ 原生/上架(可选)。

## 顺序
P1 → P2 → P3 → P4 → P5,每步独立提交、绿。P5 默认关 flag,确保不破坏当前可用的本地版。

## 验收
P1–P4 在不接任何外部账号下可用且全绿;P5 代码就绪、flag 关时零影响;morning-checklist 写清需用户的部分。tsc/test/build 全绿。
