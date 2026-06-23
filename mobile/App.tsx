import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, View } from "react-native";

// Imported from the SHARED pure domain at <repo>/src/domain (NOT copied here).
// Resolves via the "@core" alias wired in metro.config.js + babel.config.js.
// Proves the domain bundles in React Native.
import { LIFE_AREAS, AREA_LABELS } from "@core/types";

export default function App() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Life Planner (mobile)</Text>
        <Text style={styles.subtitle}>
          人生五大领域 · shared from src/domain
        </Text>
        {LIFE_AREAS.map((area) => (
          <View key={area} style={styles.row}>
            <Text style={styles.label}>{AREA_LABELS[area]}</Text>
            <Text style={styles.code}>{area}</Text>
          </View>
        ))}
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    paddingTop: 72,
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 6,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: "#f4f4f5",
  },
  label: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
  },
  code: {
    fontSize: 13,
    color: "#888",
  },
});
