import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { decisionPersonalityPresentationByCode, type DecisionStyleCode } from "@lifeplanner/core/decisionStyle";
import { colors } from "../theme";

const SOURCES = {
  FDBG: require("../../assets/decision-style/characters/FDBG.png"),
  FDBV: require("../../assets/decision-style/characters/FDBV.png"),
  FDLG: require("../../assets/decision-style/characters/FDLG.png"),
  FDLV: require("../../assets/decision-style/characters/FDLV.png"),
  FWBG: require("../../assets/decision-style/characters/FWBG.png"),
  FWBV: require("../../assets/decision-style/characters/FWBV.png"),
  FWLG: require("../../assets/decision-style/characters/FWLG.png"),
  FWLV: require("../../assets/decision-style/characters/FWLV.png"),
  SDBG: require("../../assets/decision-style/characters/SDBG.png"),
  SDBV: require("../../assets/decision-style/characters/SDBV.png"),
  SDLG: require("../../assets/decision-style/characters/SDLG.png"),
  SDLV: require("../../assets/decision-style/characters/SDLV.png"),
  SWBG: require("../../assets/decision-style/characters/SWBG.png"),
  SWBV: require("../../assets/decision-style/characters/SWBV.png"),
  SWLG: require("../../assets/decision-style/characters/SWLG.png"),
  SWLV: require("../../assets/decision-style/characters/SWLV.png"),
} satisfies Record<DecisionStyleCode, number>;

export function DecisionStyleCharacter({
  code,
  size = 220,
}: {
  code: DecisionStyleCode;
  size?: number;
}) {
  const presentation = decisionPersonalityPresentationByCode(code);
  const [failedCharacterId, setFailedCharacterId] = React.useState<DecisionStyleCode | null>(null);
  if (!presentation) return null;

  const { characterId } = presentation;
  const source = SOURCES[characterId];

  if (failedCharacterId === characterId) {
    return (
      <View
        accessible
        accessibilityLabel={`${characterId} 人格角色`}
        style={[styles.fallback, { width: size, height: size }]}
      />
    );
  }

  return (
    <Image
      source={source}
      accessibilityLabel={`${characterId} 人格角色`}
      resizeMode="contain"
      onError={() => setFailedCharacterId(characterId)}
      style={{ width: size, height: size }}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderRadius: 72,
    backgroundColor: colors.accentSoft,
  },
});
