import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type OpenAI from "openai";
import {
  formHasUserEnteredData,
  mapRequirementDraftToForm,
  mergeMappedDraft,
} from "@/lib/ai/apply-requirement-draft";
import {
  MAX_REQUIREMENT_INPUT_LENGTH,
  assistRequirementDraft,
  resetAiRateLimitForTests,
  validateRequirementInput,
  type RequirementDraft,
} from "@/lib/ai/requirement-assistant";

const sampleDraft: RequirementDraft = {
  requestTitle: "توريد أكواب قهوة ورقية",
  items: [
    {
      name: "أكواب قهوة ورقية",
      quantity: 10,
      unit: "كرتون",
      specifications: "8 أونص، لون أبيض",
      acceptableAlternatives: null,
    },
  ],
  deliveryCity: "حائل",
  requestedDeliveryText: "قبل الخميس",
  generalNotes: null,
  missingInformation: ["تاريخ توصيل محدد"],
  clarificationQuestions: ["ما هو آخر موعد مقبول للتوصيل بالتاريخ؟"],
};

function mockOpenAIClient(draft: RequirementDraft | null, error?: unknown): OpenAI {
  return {
    responses: {
      parse: async () => {
        if (error) throw error;
        return { output_parsed: draft };
      },
    },
  } as unknown as OpenAI;
}

test.beforeEach(() => {
  resetAiRateLimitForTests();
  process.env.OPENAI_API_KEY = "test-key-not-real";
  delete process.env.SAFQAH_AI_API_KEY;
});

test("valid Arabic input returns the expected structured shape", async () => {
  const result = await assistRequirementDraft(
    "أحتاج 10 كراتين أكواب قهوة ورقية 8 أونص لونها أبيض والتوصيل لحائل قبل الخميس",
    { client: mockOpenAIClient(sampleDraft), rateLimitKey: "t1" },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.didNotPersist, true);
  assert.equal(result.draft.requestTitle, sampleDraft.requestTitle);
  assert.equal(result.draft.items[0]?.name, "أكواب قهوة ورقية");
  assert.equal(result.draft.items[0]?.quantity, 10);
  assert.equal(result.draft.deliveryCity, "حائل");
  assert.equal(result.draft.requestedDeliveryText, "قبل الخميس");
  assert.ok(Array.isArray(result.draft.missingInformation));
  assert.ok(Array.isArray(result.draft.clarificationQuestions));
});

test("Saudi dialect input is accepted", async () => {
  const result = await assistRequirementDraft(
    "ابي 10 كراتين اكواب قهوة ورقية 8 اونص لونها ابيض والتوصيل لفرعنا بحائل قبل الخميس",
    { client: mockOpenAIClient(sampleDraft), rateLimitKey: "t2" },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.deliveryCity, "حائل");
});

test("empty input is rejected", async () => {
  const validation = validateRequirementInput("   ");
  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(validation.code, "EMPTY_INPUT");

  const result = await assistRequirementDraft("   ", {
    client: mockOpenAIClient(sampleDraft),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "EMPTY_INPUT");
  assert.match(result.message, /اكتب/);
});

test("oversized input is rejected", async () => {
  const huge = "م".repeat(MAX_REQUIREMENT_INPUT_LENGTH + 1);
  const validation = validateRequirementInput(huge);
  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(validation.code, "INPUT_TOO_LONG");

  const result = await assistRequirementDraft(huge, {
    client: mockOpenAIClient(sampleDraft),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "INPUT_TOO_LONG");
});

test("non-buyer access is rejected in the server action", () => {
  const source = readFileSync("app/actions/mutations.ts", "utf8");
  const actionStart = source.indexOf("export async function assistRequirementAction");
  const actionEnd = source.indexOf("export async function publishPurchaseRequest");
  assert.ok(actionStart >= 0);
  assert.ok(actionEnd > actionStart);
  const actionBody = source.slice(actionStart, actionEnd);
  assert.match(actionBody, /requireSession\(\["buyer"\]\)/);
  assert.match(actionBody, /حسابات المشترين فقط/);
  assert.doesNotMatch(actionBody, /getDb\(/);
  assert.doesNotMatch(actionBody, /publishPurchaseRequest\(/);
  assert.doesNotMatch(actionBody, /insert\(/);
});

test("API failure returns a safe Arabic message", async () => {
  const result = await assistRequirementDraft("أحتاج أكواب قهوة", {
    client: mockOpenAIClient(null, Object.assign(new Error("boom"), { status: 500 })),
    rateLimitKey: "t3",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "API_ERROR");
  assert.match(result.message, /تعذر|أكمل/);
  assert.doesNotMatch(result.message, /boom|stack|gpt|openai|api key/i);
});

test("missing API key returns NOT_CONFIGURED with AI_KEY_MISSING diag in non-production", async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.SAFQAH_AI_API_KEY;
  // NODE_ENV is typically "test" under the test runner — not production.
  assert.notEqual(process.env.NODE_ENV, "production");
  try {
    const result = await assistRequirementDraft("أحتاج أكواب", {
      client: mockOpenAIClient(sampleDraft),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "NOT_CONFIGURED");
    assert.equal(result.diagCode, "AI_KEY_MISSING");
    assert.match(result.message, /غير متاح/);
  } finally {
    process.env.OPENAI_API_KEY = "test-key-not-real";
  }
});

test("auth failure classifies as AI_AUTH_FAILED without leaking details", async () => {
  const err = Object.assign(new Error("Incorrect API key provided: sk-test"), {
    status: 401,
  });
  const result = await assistRequirementDraft("أحتاج أكواب", {
    client: mockOpenAIClient(null, err),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "API_ERROR");
  assert.equal(result.diagCode, "AI_AUTH_FAILED");
  assert.doesNotMatch(result.message, /sk-test|Incorrect API key/i);
});

test("existing form values are not overwritten without explicit confirmation", () => {
  assert.equal(
    formHasUserEnteredData({
      title: "طلب قائم",
      notes: "",
      deliveryCity: "",
      deliveryDistrict: "",
      deliveryAddressText: "",
      items: [
        {
          productName: "منتج موجود",
          unitLabel: "",
          specificationNotes: "",
          quantity: "",
        },
      ],
    }),
    true,
  );

  const mapped = mapRequirementDraftToForm(sampleDraft);
  const merged = mergeMappedDraft(
    {
      title: "طلب قائم",
      notes: "ملاحظة المشتري",
      cityChoice: "الرياض",
      otherCity: "",
      items: [
        {
          productName: "منتج موجود",
          description: "",
          quantity: 2,
          unitLabel: "علبة",
          specificationNotes: "",
          acceptedAlternatives: "",
          brandPreference: "",
          minShelfLifeMonths: "",
        },
      ],
    },
    mapped,
    false,
  );

  assert.equal(merged.title, "طلب قائم");
  assert.equal(merged.notes, "ملاحظة المشتري");
  assert.equal(merged.cityChoice, "الرياض");
  assert.equal(merged.items[0]?.productName, "منتج موجود");

  const composer = readFileSync("components/request-composer.tsx", "utf8");
  assert.match(composer, /window\.confirm/);
  assert.match(composer, /تطبيق الاقتراح/);
  assert.match(composer, /formHasUserEnteredData/);
});

test("no request is automatically saved or published by AI assist", async () => {
  const result = await assistRequirementDraft("أبي أكواب", {
    client: mockOpenAIClient(sampleDraft),
    rateLimitKey: "t4",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.didNotPersist, true);

  const assistant = readFileSync("lib/ai/requirement-assistant.ts", "utf8");
  assert.doesNotMatch(assistant, /getDb\(/);
  assert.doesNotMatch(assistant, /purchaseRequests/);
  assert.doesNotMatch(assistant, /publishPurchaseRequest/);

  const composer = readFileSync("components/request-composer.tsx", "utf8");
  assert.match(composer, /setAiDraft\(result\.draft\)/);
  assert.doesNotMatch(
    composer.slice(composer.indexOf("function runAi"), composer.indexOf("function applyAiSuggestion")),
    /publishPurchaseRequest/,
  );
});
