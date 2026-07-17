/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { decisionPersonalityPresentationByCode, type DecisionStyleCode } from "@/domain/decisionStyle";

export function DecisionStyleCharacter({
  code,
  size = 280,
  className,
}: {
  code: DecisionStyleCode;
  size?: number;
  className?: string;
}) {
  const presentation = decisionPersonalityPresentationByCode(code);
  const [failedCharacterId, setFailedCharacterId] = useState<DecisionStyleCode | null>(null);
  if (!presentation) return null;

  const { characterId } = presentation;

  if (failedCharacterId === characterId) {
    return (
      <div
        role="img"
        aria-label={`${characterId} 人格角色`}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "42% 58% 48% 52%",
          background: "var(--accent-soft)",
        }}
      />
    );
  }

  return (
    <img
      src={`/decision-style/characters/${characterId}.png`}
      alt={`${characterId} 人格角色`}
      width={size}
      height={size}
      className={className}
      onError={() => setFailedCharacterId(characterId)}
    />
  );
}
