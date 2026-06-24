// 引导屏：录入真实的你 → 由结构化信息推导五大领域起点 + 现状摘要 → 生成人生树。
// 没有存档时由根布局直接渲染本屏（不是路由），完成后 tree 落地、自动进入主界面。
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { Button, Input, Muted } from "../ui";
import { colors, space } from "../theme";

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { borderColor: colors.line },
              ]}
            >
              <Text style={[styles.chipText, active && { color: "#fff" }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export default function OnboardingScreen() {
  const { onboard } = useApp();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [education, setEducation] = useState<EducationLevel>("bachelor");
  const [occupation, setOccupation] = useState("");
  const [salary, setSalary] = useState<SalaryBand>("5to10");
  const [relationship, setRelationship] = useState<RelationshipStatus>("single");
  const [location, setLocation] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [crossroad, setCrossroad] = useState("");

  const ageNum = parseInt(age, 10);
  const valid = name.trim().length > 0 && Number.isFinite(ageNum) && ageNum >= 10 && ageNum <= 100;

  const submit = () => {
    if (!valid) return;
    const inputs: ProfileInputs = {
      name: name.trim(),
      age: ageNum,
      education,
      major: "",
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
    onboard(inputs);
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space, paddingBottom: insets.bottom + 48 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.h1}>先认识一下你</Text>
      <Muted style={{ marginBottom: 20 }}>
        填得越真实，人生树的起点和预测越贴近你。只存在你手机本地。
      </Muted>

      <Field label="怎么称呼你">
        <Input value={name} onChangeText={setName} placeholder="名字 / 昵称" />
      </Field>
      <Field label="年龄">
        <Input
          value={age}
          onChangeText={setAge}
          placeholder="如 25"
          keyboardType="number-pad"
          maxLength={3}
        />
      </Field>

      <ChipGroup label="学历" options={EDUCATION_OPTIONS} value={education} onChange={setEducation} />

      <Field label="现在做什么">
        <Input value={occupation} onChangeText={setOccupation} placeholder="职业 / 身份（可空）" />
      </Field>

      <ChipGroup label="月收入" options={SALARY_OPTIONS} value={salary} onChange={setSalary} />
      <ChipGroup
        label="感情状态"
        options={RELATIONSHIP_OPTIONS}
        value={relationship}
        onChange={setRelationship}
      />

      <Field label="现在生活在哪">
        <Input value={location} onChangeText={setLocation} placeholder="城市 / 国家（可空）" />
      </Field>
      <Field label="爱好">
        <Input value={hobbies} onChangeText={setHobbies} placeholder="如 跑步、写作（可空）" />
      </Field>
      <Field label="现在最纠结的岔路">
        <Input
          value={crossroad}
          onChangeText={setCrossroad}
          placeholder="如 要不要换行 / 要不要出国（可空）"
          multiline
          style={{ minHeight: 64, textAlignVertical: "top" }}
        />
      </Field>

      <Button label="生成我的人生树" onPress={submit} disabled={!valid} />
      {!valid ? (
        <Muted style={{ marginTop: 8, textAlign: "center" }}>填写名字和年龄后即可生成</Muted>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space },
  h1: { fontSize: 30, fontWeight: "700", color: colors.fg, marginBottom: 6 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: colors.fg, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.fg },
});
