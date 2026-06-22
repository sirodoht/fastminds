const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_INSIGHT_MODEL = "gpt-5.5";
const DEFAULT_INSIGHT_REASONING_EFFORT = "xhigh";

type OpenAITextPart = {
  type?: string;
  text?: string;
};

type OpenAIOutputItem = {
  content?: OpenAITextPart[];
};

type OpenAIResponse = {
  output_text?: string;
  output?: OpenAIOutputItem[];
  error?: {
    message?: string;
  };
};

export function extractResponseOutputText(response: OpenAIResponse): string {
  if (typeof response.output_text === "string") {
    return response.output_text.trim();
  }

  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();

  return text || "";
}

export async function generatePostInsight({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_INSIGHTS_MODEL || DEFAULT_INSIGHT_MODEL;
  const reasoningEffort =
    process.env.OPENAI_INSIGHTS_REASONING_EFFORT || DEFAULT_INSIGHT_REASONING_EFFORT;
  const content = body.trim()
    ? `Title: ${title}\n\nQuestion details:\n${body}`
    : `Title: ${title}`;

  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: reasoningEffort },
      instructions:
        "Write exactly 3 concise markdown bullets that make people want to answer this question. Each bullet should hint at a different possible response angle without taking a side: a principle, a lived tension, and a practical stake. Keep each bullet under 16 words. No intro, outro, labels, or advice.",
      input: content,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as OpenAIResponse;

  if (!res.ok) {
    const message = data.error?.message || `OpenAI request failed (${res.status})`;
    throw new Error(message);
  }

  const insight = extractResponseOutputText(data);
  if (!insight) {
    throw new Error("OpenAI returned an empty insight");
  }

  return { insight, model };
}
