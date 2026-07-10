import { SHARE_BASE_URL } from "./supabase";

const EVENTS = [
  "style_view",
  "style_start",
  "style_skip",
  "style_complete",
  "style_share",
  "style_share_open",
  "style_compare_start",
  "style_compare_complete",
  "style_continue_tree",
] as const;

type DecisionStyleEvent = (typeof EVENTS)[number];
type DecisionStyleSource = "direct" | "shared" | "compare";

export async function trackAppDecisionStyleEvent(
  event: DecisionStyleEvent,
  source: DecisionStyleSource = "direct",
): Promise<void> {
  try {
    await fetch(`${SHARE_BASE_URL}/api/style-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, surface: "app", source, test_version: 2 }),
    });
  } catch {
    // Analytics must never block the onboarding or sharing flow.
  }
}
