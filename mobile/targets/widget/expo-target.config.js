// iOS 主屏小组件 target（@bacons/apple-targets 会在 `npx expo prebuild -p ios` 时
// 生成 Xcode target 并把本目录下的文件链接进去；Info.plist 缺省自动生成）。
//
// App Group 与主 app 共享（镜像 app.json 的 ios.entitlements）——
// RN 侧用 ExtensionStorage 写快照，Swift 侧用 UserDefaults(suiteName:) 读。
//
// 注意：app.json 未设 ios.appleTeamId（插件只会警告，不会报错）；
// 签名交给 EAS Build 的托管凭据 —— 若 EAS 构建因签名失败，在 app.json 的
// ios.appleTeamId 填 Apple Team ID（Xcode Signing & Capabilities 可查）。
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "widget",
  displayName: "人生树",
  // deploymentTarget 不设 → 插件默认 18.0（README 默认值）。
  colors: {
    // 生成的 Info.plist 会引用（小组件编辑态背景/强调色）。
    $widgetBackground: "#FFFFFF",
    // 品牌紫罗兰 = Color(red: 0.42, green: 0.16, blue: 0.85)。
    $accent: "#6B29D9",
  },
  entitlements: {
    // 与主 app 相同的 App Group（group.com.jelly13124.lifeplanner）。
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});
