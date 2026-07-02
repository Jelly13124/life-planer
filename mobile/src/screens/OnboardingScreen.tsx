// 引导屏：分步向导（一页一步）→ 录入真实的你 → 推导五大领域起点 + 现状摘要 → 生成人生树。
// 没有存档时由根布局直接渲染本屏（不是路由），完成后 tree 落地、自动进入主界面。
// 作息时间用原生时间选择器：Android 走系统弹窗，iOS 走滚轮弹窗（Modal 包裹）。
import React, { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  EDUCATION_OPTIONS,
  SALARY_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "@lifeplanner/core/profile";
import type {
  EducationLevel,
  RelationshipStatus,
  SalaryBand,
} from "@lifeplanner/core/types";
import { useApp, type ProfileInputs } from "../state/store";
import PredictingOverlay from "../components/PredictingOverlay";
import { Button, Input, Muted } from "../ui";
import { colors, radii, space } from "../theme";

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.chip,
              active ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: colors.line },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.chipText, active && { color: "#fff" }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subLabel}>{children}</Text>;
}

const fmtTime = (dt: Date) =>
  `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;

function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 7, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export default function OnboardingScreen() {
  const { onboard, enriching } = useApp();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [education, setEducation] = useState<EducationLevel>("bachelor");
  const [major, setMajor] = useState("");
  const [occupation, setOccupation] = useState("");
  const [salary, setSalary] = useState<SalaryBand>("5to10");
  const [relationship, setRelationship] = useState<RelationshipStatus>("single");
  const [location, setLocation] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [crossroad, setCrossroad] = useState("");
  const [wake, setWake] = useState("07:00");
  const [sleep, setSleep] = useState("23:00");
  const [picker, setPicker] = useState<"wake" | "sleep" | null>(null);

  const ageNum = parseInt(age, 10);
  const valid = name.trim().length > 0 && Number.isFinite(ageNum) && ageNum >= 10 && ageNum <= 100;

  const applyTime = (dt: Date) => {
    const t = fmtTime(dt);
    if (picker === "wake") setWake(t);
    else if (picker === "sleep") setSleep(t);
  };
  // Android：选完即关；iOS：滚轮实时更新，点「完成」才关。
  const onChange = (e: { type: string }, dt?: Date) => {
    if (Platform.OS === "android") {
      setPicker(null);
      if (e.type !== "set" || !dt) return;
      applyTime(dt);
    } else if (dt) {
      applyTime(dt);
    }
  };

  const submit = () => {
    if (!valid) return;
    const inputs: ProfileInputs = {
      name: name.trim(),
      age: ageNum,
      education,
      major: major.trim(),
      occupation: occupation.trim(),
      salary,
      hasSideHustle: false,
      sideHustle: "",
      hobbies: hobbies.trim(),
      relationship,
      location: location.trim(),
      status: "",
      crossroad: crossroad.trim(),
    };
    onboard(inputs, { start: wake, end: sleep });
  };

  const steps: { title: string; hint?: string; required?: boolean; body: React.ReactNode }[] = [
    {
      title: "怎么称呼你",
      hint: "填得越真实，人生树的起点和预测越贴近你。只存在你手机本地。",
      required: true,
      body: (
        <>
          <SubLabel>名字 / 昵称</SubLabel>
          <Input value={name} onChangeText={setName} placeholder="名字 / 昵称" autoFocus />
          <View style={{ height: 16 }} />
          <SubLabel>年龄</SubLabel>
          <Input value={age} onChangeText={setAge} placeholder="如 25" keyboardType="number-pad" maxLength={3} />
        </>
      ),
    },
    {
      title: "学历与专业",
      body: (
        <>
          <SubLabel>学历</SubLabel>
          <ChipGroup options={EDUCATION_OPTIONS} value={education} onChange={setEducation} />
          <View style={{ height: 18 }} />
          <SubLabel>专业 / 方向</SubLabel>
          <Input value={major} onChangeText={setMajor} placeholder="如 计算机 / 金融 / 设计（可空）" />
        </>
      ),
    },
    {
      title: "现在做什么",
      body: (
        <>
          <SubLabel>职业 / 身份</SubLabel>
          <Input value={occupation} onChangeText={setOccupation} placeholder="职业 / 身份（可空）" />
          <View style={{ height: 18 }} />
          <SubLabel>月收入</SubLabel>
          <ChipGroup options={SALARY_OPTIONS} value={salary} onChange={setSalary} />
        </>
      ),
    },
    {
      title: "感情状态",
      body: <ChipGroup options={RELATIONSHIP_OPTIONS} value={relationship} onChange={setRelationship} />,
    },
    {
      title: "现在的生活",
      body: (
        <>
          <SubLabel>现在生活在哪</SubLabel>
          <Input value={location} onChangeText={setLocation} placeholder="城市 / 国家（可空）" />
          <View style={{ height: 18 }} />
          <SubLabel>爱好</SubLabel>
          <Input value={hobbies} onChangeText={setHobbies} placeholder="如 跑步、写作（可空）" />
        </>
      ),
    },
    {
      title: "现在最纠结的岔路",
      hint: "有的话写一个，没有可以跳过。",
      body: (
        <Input
          value={crossroad}
          onChangeText={setCrossroad}
          placeholder="如 要不要换行 / 要不要出国（可空）"
          multiline
          style={{ minHeight: 96, textAlignVertical: "top" }}
        />
      ),
    },
    {
      title: "作息时间",
      hint: "用来排日程的清醒时段。点一下用滚轮选。",
      body: (
        <View style={styles.timeRow}>
          <Pressable
            style={({ pressed }) => [styles.timePill, pressed && { opacity: 0.8 }]}
            onPress={() => setPicker("wake")}
          >
            <Text style={styles.timePillLabel}>起床</Text>
            <Text style={styles.timePillValue}>{wake}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.timePill, pressed && { opacity: 0.8 }]}
            onPress={() => setPicker("sleep")}
          >
            <Text style={styles.timePillLabel}>睡觉</Text>
            <Text style={styles.timePillValue}>{sleep}</Text>
          </Pressable>
        </View>
      ),
    },
  ];

  const cur = steps[step];
  const isLast = step === steps.length - 1;
  const canNext = cur.required ? valid : true;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progressRow}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[styles.progressDot, i <= step ? { backgroundColor: colors.accent } : null]}
            />
          ))}
        </View>
        <Text style={styles.stepCount}>
          第 {step + 1} / {steps.length} 步
        </Text>
        <Text style={styles.h1}>{cur.title}</Text>
        {cur.hint ? <Muted style={{ marginBottom: 20 }}>{cur.hint}</Muted> : <View style={{ height: 8 }} />}
        {cur.body}
        {cur.required && !valid ? (
          <Muted style={{ marginTop: 12 }}>填写名字和年龄（10–100）后可继续</Muted>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step > 0 ? (
          <Pressable
            onPress={() => setStep(step - 1)}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.backText}>上一步</Text>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          {isLast ? (
            <Button label="生成我的人生树" onPress={submit} disabled={!valid} />
          ) : (
            <Button label="下一步" onPress={() => setStep(step + 1)} disabled={!canNext} />
          )}
        </View>
      </View>

      {/* Android 原生时间弹窗 */}
      {picker && Platform.OS === "android" ? (
        <DateTimePicker
          value={hhmmToDate(picker === "wake" ? wake : sleep)}
          mode="time"
          is24Hour
          display="default"
          onChange={onChange}
        />
      ) : null}

      {/* iOS 滚轮时间弹窗（Modal 包裹，苹果观感） */}
      {picker && Platform.OS === "ios" ? (
        <Modal transparent animationType="slide" visible onRequestClose={() => setPicker(null)}>
          <View style={styles.pickerBg}>
            <Pressable style={{ flex: 1 }} onPress={() => setPicker(null)} />
            <View style={styles.pickerSheet}>
              <Text style={styles.pickerTitle}>{picker === "wake" ? "起床时间" : "睡觉时间"}</Text>
              <DateTimePicker
                value={hhmmToDate(picker === "wake" ? wake : sleep)}
                mode="time"
                is24Hour
                display="spinner"
                onChange={onChange}
                style={{ alignSelf: "stretch" }}
              />
              <Button label="完成" onPress={() => setPicker(null)} />
            </View>
          </View>
        </Modal>
      ) : null}

      {/* 生成人生树后 AI 推演「现状」：推演完才进首页，期间全屏动画（不可点掉——等它跑完）。 */}
      <PredictingOverlay visible={enriching} label={name.trim() || undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space, paddingBottom: 40 },
  progressRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  progressDot: { flex: 1, height: 4, borderRadius: radii.pill, backgroundColor: colors.line },
  stepCount: { fontSize: 13, color: colors.fgMuted, marginBottom: 6 },
  h1: { fontSize: 28, fontWeight: "700", color: colors.fg, marginBottom: 6 },
  subLabel: { fontSize: 14, fontWeight: "600", color: colors.fg, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill, borderWidth: 1 },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.fg },
  timeRow: { flexDirection: "row", gap: 12 },
  timePill: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timePillLabel: { fontSize: 15, color: colors.fgMuted },
  timePillValue: { fontSize: 18, fontWeight: "700", color: colors.fg },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: space,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  backBtn: { paddingHorizontal: 14, paddingVertical: 12 },
  backText: { fontSize: 15, fontWeight: "600", color: colors.fgMuted },
  pickerBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderCurve: "continuous",
    padding: 18,
    paddingBottom: 32,
    gap: 8,
  },
  pickerTitle: { fontSize: 16, fontWeight: "700", color: colors.fg, textAlign: "center" },
});
