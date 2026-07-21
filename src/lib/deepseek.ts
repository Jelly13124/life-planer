export const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export const DEEPSEEK_MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

export function getDeepSeekKey(): string | null {
  const key = process.env.DEEPSEEK_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

export function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start === -1 || end === -1 || end < start ? null : body.slice(start, end + 1);
}

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DeepSeekOptions {
  label: string;
  messages: DeepSeekMessage[];
  maxTokens: number;
  temperature?: number;
  timeoutMs?: number;
  structuredOutput?: boolean;
}

interface DeepSeekResponse {
  choices?: { message?: { content?: string } }[];
}

export async function completeDeepSeek(options: DeepSeekOptions): Promise<string | null> {
  const key = getDeepSeekKey();
  if (!key) return null;

  try {
    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: options.messages,
        response_format: options.structuredOutput && !DEEPSEEK_MODEL.includes("reasoner")
          ? { type: "json_object" }
          : undefined,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stream: false,
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
    });

    if (!response.ok) {
      console.error(`[${options.label}] DeepSeek ${response.status}`);
      return null;
    }

    const data = (await response.json()) as DeepSeekResponse;
    const content = data.choices?.[0]?.message?.content;
    return content && content.trim() ? content.trim() : null;
  } catch (error) {
    console.error(`[${options.label}] failed:`, error);
    return null;
  }
}
