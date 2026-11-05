/**
 * Meta Llama inference for the requirement assistant, hosted on
 * Cloudflare Workers AI (REST API).
 *
 * Server-only. Never import from browser components.
 *
 * Required env (server-only, never NEXT_PUBLIC_*):
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN   (token with "Workers AI: Read" permission)
 *
 * Optional:
 *   LLAMA_MODEL            default: @cf/meta/llama-3.3-70b-instruct-fp8-fast
 *   SAFQAH_AI_PROVIDER     "llama" (default when Cloudflare vars exist) | "openai"
 *
 * Design notes:
 * - Workers AI JSON mode does not guarantee schema compliance, so every
 *   response is validated again with the same Zod schema the UI relies on.
 *   Invalid output is rejected, never repaired with invented values.
 * - Buyer text is passed as untrusted data inside the user message only.
 */

import type { z } from "zod";

export const DEFAULT_LLAMA_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export type LlamaFailureKind =
  | "AUTH"
  | "RATE_LIMIT"
  | "MODEL"
  | "TIMEOUT"
  | "NETWORK"
  | "PARSE"
  | "SCHEMA"
  | "UNKNOWN";

export class LlamaProviderError extends Error {
  readonly kind: LlamaFailureKind;
  readonly status?: number;

  constructor(kind: LlamaFailureKind, status?: number) {
    super(`llama_${kind.toLowerCase()}`);
    this.name = "LlamaProviderError";
    this.kind = kind;
    this.status = status;
  }
}

function env(name: string) {
  const raw = process.env[name];
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/^['"]|['"]$/g, "");
}

export function getLlamaModel() {
  return env("LLAMA_MODEL") || DEFAULT_LLAMA_MODEL;
}

export function isLlamaConfigured() {
  return Boolean(env("CLOUDFLARE_ACCOUNT_ID") && env("CLOUDFLARE_API_TOKEN"));
}

/** Llama is used whenever it is configured, unless explicitly set to openai. */
export function shouldUseLlama() {
  const provider = env("SAFQAH_AI_PROVIDER").toLowerCase();
  if (provider === "openai") return false;
  return isLlamaConfigured();
}

/**
 * JSON schema mirroring requirementDraftSchema. Kept explicit (instead of
 * auto-generated) so the shape sent to Workers AI JSON mode stays simple.
 */
export const requirementDraftJsonSchema = {
  type: "object",
  properties: {
    requestTitle: { type: ["string", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          specifications: { type: ["string", "null"] },
          acceptableAlternatives: { type: ["string", "null"] },
        },
        required: [
          "name",
          "quantity",
          "unit",
          "specifications",
          "acceptableAlternatives",
        ],
      },
    },
    deliveryCity: { type: ["string", "null"] },
    requestedDeliveryText: { type: ["string", "null"] },
    generalNotes: { type: ["string", "null"] },
    missingInformation: { type: "array", items: { type: "string" } },
    clarificationQuestions: { type: "array", items: { type: "string" } },
  },
  required: [
    "requestTitle",
    "items",
    "deliveryCity",
    "requestedDeliveryText",
    "generalNotes",
    "missingInformation",
    "clarificationQuestions",
  ],
} as const;

const OUTPUT_CONTRACT = [
  "Return ONLY one JSON object, no prose, no markdown fences.",
  "Use exactly these keys: requestTitle, items, deliveryCity, requestedDeliveryText, generalNotes, missingInformation, clarificationQuestions.",
  "Each item has exactly: name, quantity, unit, specifications, acceptableAlternatives.",
  "Use null for any unknown value. quantity must be a number or null, never a string.",
  "missingInformation and clarificationQuestions are arrays of short Arabic strings (empty arrays if nothing is missing).",
].join("\n");

/** Pulls a JSON object out of a model reply that may be an object or a string. */
export function extractJsonObject(response: unknown): unknown {
  if (response && typeof response === "object") return response;
  if (typeof response !== "string") throw new LlamaProviderError("PARSE");
  const text = response.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new LlamaProviderError("PARSE");
  }
}

export type LlamaCallOptions<T> = {
  systemPrompt: string;
  userContent: string;
  schema: z.ZodType<T>;
  timeoutMs: number;
  /** Injected fetch for tests. */
  fetchImpl?: typeof fetch;
};

export async function runLlamaStructured<T>({
  systemPrompt,
  userContent,
  schema,
  timeoutMs,
  fetchImpl = fetch,
}: LlamaCallOptions<T>): Promise<{ data: T; model: string }> {
  const accountId = env("CLOUDFLARE_ACCOUNT_ID");
  const token = env("CLOUDFLARE_API_TOKEN");
  if (!accountId || !token) throw new LlamaProviderError("AUTH");

  const model = getLlamaModel();
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
    accountId,
  )}/ai/run/${model}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: `${systemPrompt}\n\n${OUTPUT_CONTRACT}` },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: requirementDraftJsonSchema,
        },
        temperature: 0.1,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    throw new LlamaProviderError(name === "AbortError" ? "TIMEOUT" : "NETWORK");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) throw new LlamaProviderError("AUTH", res.status);
  if (res.status === 429) throw new LlamaProviderError("RATE_LIMIT", res.status);
  if (res.status === 404 || res.status === 400) throw new LlamaProviderError("MODEL", res.status);
  if (res.status >= 500) throw new LlamaProviderError("NETWORK", res.status);
  if (!res.ok) throw new LlamaProviderError("UNKNOWN", res.status);

  let body: { success?: boolean; result?: { response?: unknown } };
  try {
    body = await res.json();
  } catch {
    throw new LlamaProviderError("PARSE", res.status);
  }
  if (body.success === false || !body.result) {
    throw new LlamaProviderError("UNKNOWN", res.status);
  }

  const candidate = extractJsonObject(body.result.response);
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) throw new LlamaProviderError("SCHEMA");

  return { data: parsed.data, model };
}
