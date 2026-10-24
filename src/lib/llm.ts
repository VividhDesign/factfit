/**
 * One adapter for every provider: generateObject(schema, { system, user }).
 * LLM_PROVIDER picks "anthropic" (default) or "gemini". Server-side only: keys never reach the browser.
 * Every reply is validated with Zod; on failure it retries once and sends the validation error back.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export interface GenOpts {
  system: string;
  user: string;
  /** "fast" uses LLM_MODEL_FAST when set; otherwise the main model. */
  model?: "default" | "fast";
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

export type GenerateObject = <T>(schema: z.ZodType<T>, opts: GenOpts) => Promise<T>;

export class LlmError extends Error {}

interface Turn {
  role: "user" | "assistant";
  content: string;
}

interface Provider {
  complete(schema: z.ZodType, opts: GenOpts, extra: Turn[]): Promise<string>;
}

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";

// ---------- Anthropic ----------

let anthropicClient: Anthropic | undefined;

const anthropic: Provider = {
  async complete(schema, opts, extra) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new LlmError("ANTHROPIC_API_KEY is not set. Add it to .env.local (or set LLM_PROVIDER=gemini).");
    }
    anthropicClient ??= new Anthropic();
    const model =
      (opts.model === "fast" && process.env.LLM_MODEL_FAST) || process.env.LLM_MODEL || DEFAULT_ANTHROPIC_MODEL;
    // `effort` is only accepted by the 4.5+ model families.
    const supportsEffort = /sonnet-5|opus-5|opus-4-[5-9]|fable|haiku-5|mythos/.test(model);
    const res = await anthropicClient.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 16000,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }, ...extra],
      output_config: {
        ...(supportsEffort ? { effort: opts.effort ?? "medium" } : {}),
        format: zodOutputFormat(schema as z.ZodType<object>),
      },
    });
    if (res.stop_reason === "refusal") {
      throw new LlmError("The model declined this request. Try rewording the job text or the steer.");
    }
    if (res.stop_reason === "max_tokens") throw new LlmError("The model's reply was cut off (max_tokens).");
    return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  },
};

// ---------- Gemini (plain REST, no extra dependency) ----------

const gemini: Provider = {
  async complete(schema, opts, extra) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new LlmError("GEMINI_API_KEY is not set. Add it to .env.local.");
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
    void _ignored;
    const turns = [{ role: "user", content: opts.user }, ...extra];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: turns.map((t) => ({ role: t.role === "user" ? "user" : "model", parts: [{ text: t.content }] })),
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          maxOutputTokens: opts.maxTokens ?? 16000,
          // Flash models can skip thinking, which keeps a run under 30 s; the guard checks the output anyway.
          ...(/flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });
    if (!res.ok) throw new LlmError(`Gemini error ${res.status}: ${(await res.text()).slice(0, 900)}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new LlmError("Gemini returned no text.");
    return text;
  },
};

// ---------- shared ----------

function pickProvider(): Provider {
  const name = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  if (name === "anthropic") return anthropic;
  if (name === "gemini") return gemini;
  throw new LlmError(`Unknown LLM_PROVIDER "${name}". Use "anthropic" or "gemini".`);
}

/** Parses JSON (tolerating a ```json fence) and validates it. */
export function parseWith<T>(schema: z.ZodType<T>, raw: string): { ok: true; value: T } | { ok: false; error: string } {
  const body = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (e) {
    return { ok: false, error: `not valid JSON (${(e as Error).message})` };
  }
  const r = schema.safeParse(json);
  return r.success ? { ok: true, value: r.data } : { ok: false, error: z.prettifyError(r.error) };
}

export const generateObject: GenerateObject = async (schema, opts) => {
  const provider = pickProvider();
  const first = await provider.complete(schema, opts, []);
  const a = parseWith(schema, first);
  if (a.ok) return a.value;

  const second = await provider.complete(schema, opts, [
    { role: "assistant", content: first },
    { role: "user", content: `Your reply did not validate: ${a.error}\nReply again with corrected JSON only.` },
  ]);
  const b = parseWith(schema, second);
  if (b.ok) return b.value;
  throw new LlmError(`The model's reply failed validation twice: ${b.error}`);
};
