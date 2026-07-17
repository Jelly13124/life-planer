/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import type { DecisionStyleCode } from "@/domain/decisionStyle";

export function DecisionStyleCharacter({
  code,
  size = 280,
  className,
}: {
  code: DecisionStyleCode;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${code} 人格角色`}
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
      src={`/decision-style/characters/${code}.png`}
      alt={`${code} 人格角色`}
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
