import assert from "node:assert/strict";
import test from "node:test";
import {
  LlamaProviderError,
  extractJsonObject,
  runLlamaStructured,
  shouldUseLlama,
} from "@/lib/ai/llama-provider";
import { requirementDraftSchema } from "@/lib/ai/requirement-assistant";

const validDraft = {
  requestTitle: "توريد زيت",
  items: [
    { name: "زيت دوار الشمس", quantity: 50, unit: "كرتون", specifications: null, acceptableAlternatives: null },
  ],
  deliveryCity: "الرياض",
  requestedDeliveryText: "قبل الخميس",
  generalNotes: null,
  missingInformation: [],
  clarificationQuestions: [],
};

function mockFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

const base = {
  systemPrompt: "test",
  userContent: "test",
  schema: requirementDraftSchema,
  timeoutMs: 5000,
};

test.beforeEach(() => {
  process.env.CLOUDFLARE_ACCOUNT_ID = "acc-test";
  process.env.CLOUDFLARE_API_TOKEN = "token-test";
  delete process.env.SAFQAH_AI_PROVIDER;
});

test("Llama is selected when Cloudflare credentials exist", () => {
  assert.equal(shouldUseLlama(), true);
  process.env.SAFQAH_AI_PROVIDER = "openai";
  assert.equal(shouldUseLlama(), false);
});

test("valid object response passes Zod validation", async () => {
  const { data, model } = await runLlamaStructured({
    ...base,
    fetchImpl: mockFetch(200, { success: true, result: { response: validDraft } }),
  });
  assert.equal(data.items[0].quantity, 50);
  assert.match(model, /llama/);
});

test("JSON returned as a string (with fences) is parsed", async () => {
  const { data } = await runLlamaStructured({
    ...base,
    fetchImpl: mockFetch(200, {
      success: true,
      result: { response: "```json\n" + JSON.stringify(validDraft) + "\n```" },
    }),
  });
  assert.equal(data.deliveryCity, "الرياض");
});

test("schema-violating output is rejected, not repaired", async () => {
  const bad = { ...validDraft, items: [{ name: "زيت", quantity: "خمسين" }] };
  await assert.rejects(
    runLlamaStructured({ ...base, fetchImpl: mockFetch(200, { success: true, result: { response: bad } }) }),
    (err: unknown) => err instanceof LlamaProviderError && err.kind === "SCHEMA",
  );
});

test("auth and rate-limit errors are classified", async () => {
  await assert.rejects(
    runLlamaStructured({ ...base, fetchImpl: mockFetch(401, {}) }),
    (err: unknown) => err instanceof LlamaProviderError && err.kind === "AUTH",
  );
  await assert.rejects(
    runLlamaStructured({ ...base, fetchImpl: mockFetch(429, {}) }),
    (err: unknown) => err instanceof LlamaProviderError && err.kind === "RATE_LIMIT",
  );
});

test("non-JSON text is a parse failure", () => {
  assert.throws(() => extractJsonObject("sorry, I cannot help"), LlamaProviderError);
});
