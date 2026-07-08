// 和未来的自己对话（某条人生路）。复用后端 /api/chat（非流式 v1）。无后端 → 提示。
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useApp } from "../../src/state/store";
import { chatReply, hasBackend, futureAgeOf, type ChatMessage } from "../../src/lib/api";
import { shareCard } from "../../src/lib/shareCard";
import { colors, space } from "../../src/theme";

const QUICK = ["你后悔走这条路吗？", "当时最难的坎怎么熬过来的？", "给现在的我一句话"];

// 分享用：引言截断到 ≤120 字，避免分享文案过长。
function trimQuote(s: string, max = 120): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export default function ChatScreen() {
  const { pathId } = useLocalSearchParams<{ pathId: string }>();
  const { tree } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const path = tree?.paths.find((p) => p.id === pathId) ?? null;

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading || !tree || !path) return;
    if (!hasBackend()) {
      setMessages((m) => [
        ...m,
        { role: "user", content: t },
        {
          role: "assistant",
          content: "需要连接后端才能对话。设 EXPO_PUBLIC_API_BASE_URL 指向运行中的网页后端后重试。",
        },
      ]);
      setInput("");
      return;
    }
    const next: ChatMessage[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    setLoading(true);
    let reply: string | null = null;
    try {
      reply = await chatReply(tree, path, next);
    } catch {
      // 网络 / AI 失败：下面用兜底文案，绝不让 loading 卡死。
      reply = null;
    } finally {
      setLoading(false);
    }
    setMessages([
      ...next,
      { role: "assistant", content: reply ?? "（暂时连不上未来的自己，稍后再试）" },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {path ? `未来的你 · ${futureAgeOf(path)}岁` : "对话"}
          </Text>
          {path ? (
            <Text style={styles.sub} numberOfLines={1}>
              这条路：{path.choiceLabel || "维持现状"}
            </Text>
          ) : null}
        </View>
      </View>

      {!path ? (
        <View style={styles.center}>
          <Text style={styles.muted}>找不到这条路。</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top + 8}
        >
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.introCard}>
              <Text style={styles.introText}>{path.summary || "和这条路上的未来自己聊聊。"}</Text>
            </View>
            {messages.length === 0 ? (
              <View style={styles.quickWrap}>
                {QUICK.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => send(q)}
                    style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.quickText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {messages.map((m, i) => (
              <View key={i} style={{ alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <View style={m.role === "user" ? styles.userBubble : styles.aiBubble}>
                  <Text style={m.role === "user" ? styles.userText : styles.aiText}>{m.content}</Text>
                </View>
                {m.role === "assistant" ? (
                  <Pressable
                    onPress={() =>
                      void shareCard(
                        {
                          kind: "future-self",
                          title: "来自未来的我",
                          quote: trimQuote(m.content),
                          name: tree?.profile.name || undefined,
                        },
                        "未来的我对我说：",
                      )
                    }
                    hitSlop={8}
                    style={({ pressed }) => [styles.shareMsgBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.shareMsgText}>分享</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} /> : null}
          </ScrollView>

          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="问问未来的自己…"
              placeholderTextColor={colors.fgMuted}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
            />
            <Pressable
              onPress={() => send(input)}
              style={({ pressed }) => [
                styles.sendBtn,
                !input.trim() || loading ? { opacity: 0.5 } : null,
                pressed && (input.trim() && !loading) ? { opacity: 0.85 } : null,
              ]}
              disabled={!input.trim() || loading}
            >
              <Text style={styles.sendText}>发送</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: space,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  back: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "700", color: colors.fg },
  sub: { fontSize: 12, color: colors.fgMuted },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: colors.fgMuted, fontSize: 14 },
  body: { padding: space, gap: 10, paddingBottom: 24 },
  introCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  introText: { color: colors.accent, fontSize: 14, lineHeight: 20 },
  quickWrap: { gap: 8 },
  quickChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
  },
  quickText: { fontSize: 13, color: colors.fg },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: "85%",
  },
  userText: { color: "#fff", fontSize: 15, lineHeight: 21 },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: "85%",
  },
  aiText: { color: colors.fg, fontSize: 15, lineHeight: 21 },
  shareMsgBtn: { marginTop: 4, paddingHorizontal: 4, paddingVertical: 2 },
  shareMsgText: { fontSize: 12, color: colors.fgMuted, fontWeight: "600" },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: space,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.fg,
    backgroundColor: "#fff",
  },
  sendBtn: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
