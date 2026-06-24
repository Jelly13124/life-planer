# Dev build（脱离 Expo Go：动画 / 通知 / 拖拽 / 任意原生库）

Expo Go 是固定沙盒,只带一批原生模块。装了 `expo-dev-client` 后,`expo start` 会去找**你自己的开发构建(dev build)**,而不是 Expo Go。dev build = 把 app 编译成真安装包(仍是 Expo/React Native),里面带你声明的所有原生库。

已配好(本仓库):
- `eas.json`(development / preview / production 三档)
- `app.json`:名字「人生树」、`ios.bundleIdentifier` / `android.package` = `com.jelly13124.lifeplanner`、`expo-notifications` 插件
- `react-native-reanimated@4.5.0` + `react-native-worklets@0.10.0`(根 `overrides` 锁单版本)、`react-native-worklets/plugin`(babel 末位)、根布局包 `GestureHandlerRootView`、`expo-dev-client`
- 解锁:reanimated 流畅动画、真本地通知(代码已写,dev build 自动生效)、拖拽、任意图标/原生库

## A. 本地安卓 dev build(不需要 Apple 账号,在模拟器/安卓机上验证)
```
cd mobile
npx expo run:android      # 首次会 prebuild + Gradle 编译,几分钟;装到已连的模拟器/真机
```
之后日常:`npx expo start`(它连这个 dev build,不再要 Expo Go)。

## B. iOS dev build → 你的 iPhone / TestFlight（需要 Apple 开发者账号）
EAS 云端构建,处理全部原生工具链:
```
cd mobile
npm i -g eas-cli            # 或全程用 npx eas-cli
eas login                  # 登录 Expo 账号（免费注册）
eas init                   # 关联/创建 EAS 项目（会把 projectId 写进 app.json）
# 装到自己 iPhone 调试用：
eas build --platform ios --profile development
# 走 TestFlight（正式分发给测试者）：
eas build --platform ios --profile production
eas submit --platform ios   # 上传到 App Store Connect → TestFlight
```
首次 iOS 构建 EAS 会引导你登录 Apple、生成证书/描述文件(它自动管,跟着提示走)。

## 后端（AI 分支 / 对话）在 dev build 里怎么连
- 开发期:电脑开 `npm run dev`(:3000)+ `adb reverse tcp:3000 tcp:3000`(模拟器)或同 WiFi;api.ts 会自动用 Metro 主机的 :3000。
- 给真用户/TestFlight 版:把后端部署到公网(Vercel),在 `mobile/.env` 设 `EXPO_PUBLIC_API_BASE_URL=https://<域名>` 再构建。详见 `docs/mobile-backend.md`。

## 还想用 Expo Go 快速预览?
装了 dev-client 后默认走 dev build。临时回 Expo Go:`npx expo start --go`(但 reanimated 等原生版本可能与 Expo Go 不一致,以 dev build 为准)。
