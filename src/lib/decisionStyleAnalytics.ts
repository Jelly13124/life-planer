export const DECISION_STYLE_EVENTS = [
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

export type DecisionStyleEvent = (typeof DECISION_STYLE_EVENTS)[number];
export type DecisionStyleAnalyticsSource = "direct" | "shared" | "compare";

export interface TrackDecisionStyleEventOptions {
  source?: DecisionStyleAnalyticsSource;
  fetchImpl?: typeof fetch;
}

export async function trackDecisionStyleEvent(
  event: DecisionStyleEvent,
  { source = "direct", fetchImpl = globalThis.fetch }: TrackDecisionStyleEventOptions = {},
): Promise<void> {
  try {
    await fetchImpl("/api/style-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, surface: "web", source, test_version: 2 }),
      keepalive: true,
    });
  } catch {
    // Analytics is deliberately fire-and-forget from the product flow.
  }
}
