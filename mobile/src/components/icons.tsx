// 真·线性图标（@expo/vector-icons / MaterialCommunityIcons，Expo Go 自带字体，非 emoji）。
// AreaTile = Structured 风圆角图标块：领域色底 + 白图标（习惯用描边版）。
import React from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { GoalArea } from "@lifeplanner/core/types";
import { AREA_COLORS, colors } from "../theme";

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export const AREA_ICON: Record<GoalArea, IconName> = {
  career: "briefcase-outline",
  wealth: "cash-multiple",
  relationships: "heart-outline",
  health: "run",
  growth: "sprout-outline",
  other: "dots-horizontal",
};

export function Icon({
  name,
  size = 20,
  color = colors.fg,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export function AreaTile({
  area,
  size = 40,
  outline = false,
  icon,
}: {
  area?: GoalArea | null;
  size?: number;
  outline?: boolean; // 习惯用描边
  icon?: IconName;
}) {
  const color = area ? AREA_COLORS[area] : colors.fgMuted;
  const name: IconName = icon ?? (area ? AREA_ICON[area] : "circle-medium");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: outline ? "transparent" : color,
        borderWidth: outline ? 2 : 0,
        borderColor: color,
        borderStyle: outline ? "dashed" : "solid",
      }}
    >
      <MaterialCommunityIcons name={name} size={Math.round(size * 0.52)} color={outline ? color : "#fff"} />
    </View>
  );
}
