"use client";

import { useEffect } from "react";
import {
  trackDecisionStyleEvent,
  type DecisionStyleAnalyticsSource,
  type DecisionStyleEvent,
} from "@/lib/decisionStyleAnalytics";

export function DecisionStyleAnalyticsBeacon({
  event,
  source,
}: {
  event: DecisionStyleEvent;
  source: DecisionStyleAnalyticsSource;
}) {
  useEffect(() => {
    void trackDecisionStyleEvent(event, { source });
  }, [event, source]);

  return null;
}
