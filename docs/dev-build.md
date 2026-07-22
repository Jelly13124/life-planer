# Expo development build、EAS、TestFlight 与 OTA

## 当前配置

- Expo SDK `56`，React Native `0.85.3`，React `19.2.3`。
- `react-native-reanimated` `4.3.1`，`react-native-worklets` `0.8.3`。
- App 名称「人生树」，版本 `1.1.0`。
- iOS bundle identifier：`com.jelly13124.lifeplanner`。
- EAS owner：`jelly2474`；project ID：`bbb6f73c-30ed-4eb9-b2c6-97289c3bcac9`。
- `runtimeVersion.policy = appVersion`；`production` 与 `preview` channel 已定义。
- `eas.json` 已把生产 API 指向 `https://life-planer-opal.vercel.app`。

依赖由根 npm workspace 统一管理：

```bash
cd life-planer
npm ci
```

不要进入 `mobile/` 再执行一次 `npm install`，也不要重新生成 `mobile/package-lock.json`。

## 本地开发

先启动网页/API：

```bash
npm run dev
```

另开终端启动 Metro：

```bash
npm run start --workspace mobile
```

需要包含所有原生模块的安卓开发构建时：

```bash
npm run android --workspace mobile
```

Windows 不能本地编译 iOS，使用 EAS 云构建。

## EAS 构建和提交

新电脑先登录已有 Expo 账号；项目已经关联，通常不要再次运行 `eas init`：

```bash
npx eas-cli login
npx eas-cli project:info
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

EAS 远端管理 iOS build number。2026-07-21 已上传版本 `1.1.0`、build `24` 到 App Store Connect；历史 build/submission 标识见最新 handoff。

构建或提交前：

```bash
npm run verify
npx expo-doctor@latest mobile
```

## OTA 边界

只有在以下条件全部满足时才走 OTA：

- 只改 JavaScript/TypeScript 或普通资源。
- 没有新增/升级原生依赖。
- 没有修改需要重新生成原生工程的 plugin、entitlement、widget、bundle identifier 或系统权限。
- 目标 binary 的 app version/runtimeVersion 与更新一致。

发布 production OTA：

```bash
cd mobile
npx eas-cli update --channel production --message "<说明>"
```

修改 `react-native-purchases`、widget、Expo SDK、原生插件、entitlement 或原生权限时必须重新 EAS build，不能只 OTA。

## 凭据

Apple 证书和 provisioning profile 由 EAS 远端管理，不提交到 Git。新电脑需要重新登录 Expo/Apple，而不是从旧电脑复制证书目录。
