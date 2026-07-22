import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  DECISION_STYLE_SCALE_VALUES,
  decisionStyleScaleAccessibilityLabel,
  type DecisionStyleAnswerValue,
  type DecisionStyleQuestion,
} from "@lifeplanner/core/decisionStyle";
import { colors } from "../theme";

export function DecisionStyleScale({
  question,
  value,
  disabled,
  onChange,
}: {
  question: DecisionStyleQuestion;
  value?: DecisionStyleAnswerValue;
  disabled: boolean;
  onChange: (value: DecisionStyleAnswerValue) => void;
}) {
  return (
    <View>
      <View style={styles.ends}>
        <Text style={styles.endText}>{question.left.label}</Text>
        <Text style={[styles.endText, styles.endRight]}>{question.right.label}</Text>
      </View>
      <View style={styles.scale}>
        <View pointerEvents="none" style={styles.line} />
        {DECISION_STYLE_SCALE_VALUES.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={decisionStyleScaleAccessibilityLabel(question, option)}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.target,
                selected && styles.targetSelected,
                pressed && !disabled && styles.pressed,
              ]}
            >
              <View style={[styles.dot, selected && styles.dotSelected]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ends: { flexDirection: "row", justifyContent: "space-between", gap: 20, marginBottom: 18 },
  endText: { flex: 1, color: colors.fg, fontSize: 16, lineHeight: 23, fontWeight: "600" },
  endRight: { textAlign: "right" },
  scale: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  line: { position: "absolute", left: 22, right: 22, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  target: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  targetSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.fgMuted },
  dotSelected: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff" },
  pressed: { transform: [{ scale: 0.96 }] },
});
