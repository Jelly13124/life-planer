import React from "react";
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import {
  decisionPersonalityPresentationByCode,
  type DecisionStyleSummary,
} from "@lifeplanner/core/decisionStyle";
import { colors, radii } from "../theme";
import { DecisionStyleCharacter } from "./DecisionStyleCharacter";

export function DecisionPersonalityCard({
  summary,
  compact = false,
  reveal = false,
}: {
  summary: DecisionStyleSummary;
  compact?: boolean;
  reveal?: boolean;
}) {
  const item = decisionPersonalityPresentationByCode(summary.code);
  const { width } = useWindowDimensions();
  const [revealed, setRevealed] = React.useState(!reveal);
  const characterSize = compact
    ? Math.min(124, width * 0.3)
    : Math.min(190, width * 0.4);

  React.useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active) return;
      if (reduced || !reveal) {
        setRevealed(true);
      } else {
        timer = setTimeout(() => setRevealed(true), 450);
      }
    });

    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [reveal]);

  if (!item) return null;

  if (!revealed) {
    return (
      <View
        accessible
        accessibilityLabel="正在揭晓你的决策人格"
        style={[styles.card, styles.revealCard]}
      >
        <View style={styles.revealCharacter}>
          <DecisionStyleCharacter code={summary.code} size={Math.min(220, width * 0.54)} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, compact && styles.compact]}>
      <View style={styles.accentRule} />
      <Text style={styles.eyebrow}>你的决策人格</Text>
      <View style={styles.heroRow}>
        <View style={styles.copy}>
          <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.code}>
            {summary.code}
          </Text>
          <Text style={styles.label}>{item.label}</Text>
        </View>
        <DecisionStyleCharacter code={summary.code} size={characterSize} />
      </View>
      <Text style={[styles.tagline, compact && styles.compactTagline]}>{item.tagline}</Text>

      {!compact ? (
        <>
          <View style={styles.lightPanel}>
            <Text style={styles.panelLabel}>你的高光</Text>
            <Text style={styles.panelText}>{item.highlight}</Text>
          </View>
          <View style={styles.darkPanel}>
            <Text style={styles.darkLabel}>容易翻车</Text>
            <Text style={styles.darkText}>{item.roast}</Text>
          </View>
          <Text style={styles.advice}>给你的提醒：{item.advice}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: "#f4eadf",
    padding: 20,
  },
  compact: { padding: 16 },
  revealCard: { minHeight: 360, alignItems: "center", justifyContent: "center" },
  revealCharacter: { opacity: 0.35, alignItems: "center" },
  accentRule: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    backgroundColor: colors.accent,
  },
  eyebrow: { color: "#725f50", fontSize: 12, fontWeight: "600", letterSpacing: 1.4 },
  heroRow: { flexDirection: "row", alignItems: "center" },
  copy: { flex: 1, minWidth: 0, zIndex: 1 },
  code: { color: "#251f1a", fontSize: 52, fontWeight: "900", letterSpacing: -3 },
  label: { color: "#342b24", fontSize: 20, fontWeight: "700", marginTop: 2 },
  tagline: {
    color: "#342b24",
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "600",
    marginBottom: 14,
  },
  compactTagline: { fontSize: 16, lineHeight: 24, marginBottom: 0 },
  lightPanel: {
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.68)",
    padding: 14,
    marginTop: 10,
  },
  darkPanel: {
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: "#2d2925",
    padding: 14,
    marginTop: 10,
  },
  panelLabel: { color: colors.accent, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  panelText: { color: "#251f1a", fontSize: 15, lineHeight: 22 },
  darkLabel: { color: "#d9b99d", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  darkText: { color: "#fffaf4", fontSize: 15, lineHeight: 22 },
  advice: { color: "#695c52", fontSize: 14, lineHeight: 21, marginTop: 14 },
});
