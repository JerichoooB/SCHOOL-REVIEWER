import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../api/generate-quiz.js";
import {
  validateQuestions,
  validateInput,
  selectFlashModel,
  generationSettings,
  fetchWithRetry,
} from "../server/aiQuiz.js";
import { emptyData, validateData } from "../src/services/database.js";
const evidence =
  "A database organizes information into structured tables for efficient retrieval.";
const sections = [
  {
    source: "Page 1",
    text: evidence + " A primary key uniquely identifies each record.",
  },
];
const question = {
  prompt: "Why is organizing information into tables useful?",
  options: [
    "It enables efficient retrieval.",
    "It guarantees every value is unique.",
    "It removes the need for records.",
    "It prevents all data changes.",
  ],
  answer: "It enables efficient retrieval.",
  explanation:
    "Structured tables organize information for efficient retrieval.",
  source: "Page 1",
  evidence,
};
const environment = {
  GEMINI_API_KEY: "test-provider-key-not-real",
  RECALL_AI_MODEL: "gemini-2.5-flash-lite",
};
const response = (payload) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
const providerResult = (q) => ({
  candidates: [
    {
      finishReason: "STOP",
      content: { parts: [{ text: JSON.stringify({ questions: q }) }] },
    },
  ],
});
async function invoke({
  body = { sections, count: 3 },
  method = "POST",
  headers = {},
  env = environment,
  fetchImpl = async () => response(providerResult([question])),
} = {}) {
  let status = 200,
    data;
  const responseHeaders = {};
  const res = {
    setHeader(k, v) {
      responseHeaders[k] = v;
    },
    status(n) {
      status = n;
      return this;
    },
    json(value) {
      data = value;
      return this;
    },
  };
  await createHandler({ environment: env, fetchImpl })(
    {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body,
    },
    res,
  );
  return { status, data, headers: responseHeaders };
}
test("server calls Gemini with bounded source text and validates structured MC output", async () => {
  let called = false;
  const result = await invoke({
    fetchImpl: async (url, options) => {
      called = true;
      assert.match(
        url,
        /generativelanguage.googleapis.com\/v1beta\/models\/gemini-2.5-flash-lite:generateContent/,
      );
      assert.equal(
        options.headers["x-goog-api-key"],
        environment.GEMINI_API_KEY,
      );
      const payload = JSON.parse(options.body);
      assert.equal(
        payload.generationConfig.responseMimeType,
        "application/json",
      );
      assert.match(payload.systemInstruction.parts[0].text, /untrusted/);
      assert.deepEqual(
        JSON.parse(payload.contents[0].parts[0].text).document_sections,
        sections,
      );
      return response(providerResult([question]));
    },
  });
  assert.ok(called); // No client credentials are required to generate.
  assert.equal(result.status, 200);
  assert.equal(result.data.questions[0].type, "multiple_choice");
  assert.deepEqual(result.data.questions[0].accepted, [question.answer]);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.ok(!JSON.stringify(result.data).includes(environment.GEMINI_API_KEY));
});
test("unconfigured and invalid requests never call Gemini", async () => {
  const fetchImpl = () => {
    throw new Error("must not call provider");
  };
  assert.equal((await invoke({ method: "GET", fetchImpl })).status, 405);
  assert.equal((await invoke({ env: {}, fetchImpl })).status, 503);
  assert.equal(
    (await invoke({ headers: { "content-type": "text/plain" }, fetchImpl }))
      .status,
    415,
  );
  assert.equal(
    (await invoke({ body: { sections, count: 1000 }, fetchImpl })).status,
    400,
  );
  assert.equal(
    (
      await invoke({
        body: {
          sections: [{ source: "Page 1", text: "x".repeat(60001) }],
          count: 3,
        },
        fetchImpl,
      })
    ).status,
    400,
  );
  assert.equal((await invoke({ body: "{broken", fetchImpl })).status, 400);
  assert.equal(
    (await invoke({ headers: { "content-length": "250001" }, fetchImpl }))
      .status,
    413,
  );
});
test("rejects unsupported citations, duplicate choices, ambiguous answers, and blank-word questions", () => {
  assert.throws(() =>
    validateQuestions(
      {
        questions: [
          {
            ...question,
            evidence:
              "A fabricated quotation that does not occur in the source.",
          },
        ],
      },
      sections,
      3,
    ),
  );
  assert.throws(() =>
    validateQuestions(
      { questions: [{ ...question, source: "Slide 99" }] },
      sections,
      3,
    ),
  );
  assert.throws(() =>
    validateQuestions(
      {
        questions: [
          { ...question, options: ["same", "Same", "third", "fourth"] },
        ],
      },
      sections,
      3,
    ),
  );
  assert.throws(() =>
    validateQuestions(
      { questions: [{ ...question, answer: "Not an option" }] },
      sections,
      3,
    ),
  );
  assert.throws(() =>
    validateQuestions(
      {
        questions: [
          { ...question, prompt: "A database ________ information." },
        ],
      },
      sections,
      3,
    ),
  );
  assert.throws(() =>
    validateQuestions({ questions: [question, question] }, sections, 3),
  );
  assert.throws(() =>
    validateInput({ sections: [...sections, ...sections], count: 3 }),
  );
});
test("provider quota, blocked responses, malformed output and timeouts return actionable errors", async () => {
  assert.equal(
    (
      await invoke({
        fetchImpl: async () => new Response("{}", { status: 429 }),
      })
    ).status,
    429,
  );
  assert.equal(
    (
      await invoke({
        fetchImpl: async () => new Response("{}", { status: 403 }),
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await invoke({
        fetchImpl: async () =>
          response({ promptFeedback: { blockReason: "SAFETY" } }),
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await invoke({
        fetchImpl: async () =>
          response({ candidates: [{ finishReason: "MAX_TOKENS" }] }),
      })
    ).status,
    502,
  );
  assert.equal(
    (
      await invoke({
        fetchImpl: async () =>
          response({
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: "invalid" }] },
              },
            ],
          }),
      })
    ).status,
    502,
  );
  assert.equal(
    (
      await invoke({
        fetchImpl: async () => {
          throw new DOMException("timeout", "TimeoutError");
        },
      })
    ).status,
    504,
  );
});
test("AI MC quizzes survive backup validation while legacy quizzes remain compatible", () => {
  const q = validateQuestions({ questions: [question] }, sections, 3)[0];
  const data = {
    ...emptyData(),
    quizzes: [
      {
        id: "quiz",
        name: "Lesson",
        subjectId: "",
        questions: [{ ...q, id: "question" }],
      },
    ],
  };
  assert.equal(validateData(data), data);
  assert.throws(() =>
    validateData({
      ...data,
      quizzes: [
        {
          ...data.quizzes[0],
          questions: [
            {
              ...q,
              id: "question",
              options: ["duplicate", "duplicate", "C", "D"],
            },
          ],
        },
      ],
    }),
  );
  const legacy = {
    ...data,
    quizzes: [
      {
        ...data.quizzes[0],
        questions: [
          {
            id: "question",
            prompt: "What is a table?",
            accepted: ["a collection of records"],
            explanation: "",
            source: "Page 1",
          },
        ],
      },
    ],
  };
  assert.equal(validateData(legacy), legacy);
});

test("Gemini uses the compatible responseSchema format and trims deployment configuration", async () => {
  const result = await invoke({
    env: {
      GEMINI_API_KEY: "  test-key  ",
      RECALL_AI_MODEL: " models/gemini-2.5-flash-lite ",
    },
    fetchImpl: async (url, options) => {
      assert.equal(options.headers["x-goog-api-key"], "test-key");
      assert.match(url, /models\/gemini-2.5-flash-lite:generateContent$/);
      const { generationConfig } = JSON.parse(options.body);
      assert.equal(generationConfig.responseJsonSchema, undefined);
      assert.equal(generationConfig.responseSchema.type, "OBJECT");
      assert.equal(
        generationConfig.responseSchema.additionalProperties,
        undefined,
      );
      assert.equal(
        generationConfig.responseSchema.properties.questions.type,
        "ARRAY",
      );
      assert.equal(
        generationConfig.responseSchema.properties.questions.items.properties
          .options.items.type,
        "STRING",
      );
      return response(providerResult([question]));
    },
  });
  assert.equal(result.status, 200);
});
test("specific Gemini rejection diagnostics never echo provider secrets or document text", async () => {
  const cases = [
    [400, "API_KEY_INVALID", "invalid key", "API_KEY_INVALID"],
    [403, "API_KEY_LEAKED", "reported as leaked", "API_KEY_LEAKED"],
    [403, "SERVICE_DISABLED", "API disabled", "SERVICE_DISABLED"],
    [403, "API_KEY_HTTP_REFERRER_BLOCKED", "blocked", "KEY_RESTRICTION"],
    [403, "API_KEY_IP_ADDRESS_BLOCKED", "blocked", "KEY_RESTRICTION"],
    [
      400,
      "FAILED_PRECONDITION",
      "User location is not supported",
      "REGION_UNSUPPORTED",
    ],
    [404, "NOT_FOUND", "Model not found", "MODEL_UNAVAILABLE"],
    [
      400,
      "INVALID_ARGUMENT",
      "Unknown name responseJsonSchema",
      "REQUEST_REJECTED",
    ],
    [403, "PERMISSION_DENIED", "Not allowed", "PERMISSION_DENIED"],
    [429, "RESOURCE_EXHAUSTED", "Quota exceeded", "QUOTA_EXCEEDED"],
  ];
  for (const [status, reason, message, expected] of cases) {
    const result = await invoke({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: {
              message: message + " secret-marker " + evidence,
              details: [{ reason, metadata: { key: "secret-marker" } }],
            },
          }),
          { status },
        ),
    });
    assert.equal(result.data.code, expected);
    assert.equal(result.data.providerStatus, status);
    assert.ok(!JSON.stringify(result.data).includes("secret-marker"));
    assert.ok(!JSON.stringify(result.data).includes(evidence));
    assert.notEqual(result.data.error, "Gemini rejected the request.");
  }
});

test("default generation discovers a supported Flash model instead of pinning a retired ID", async () => {
  const calls = [];
  const result = await invoke({
    env: { GEMINI_API_KEY: environment.GEMINI_API_KEY },
    fetchImpl: async (url, options) => {
      calls.push(url);
      assert.equal(
        options.headers["x-goog-api-key"],
        environment.GEMINI_API_KEY,
      );
      if (options.method === "GET")
        return response({
          models: [
            {
              name: "models/gemini-3.1-pro",
              supportedGenerationMethods: ["generateContent"],
            },
            {
              name: "models/gemini-3.1-flash-image",
              supportedGenerationMethods: ["generateContent"],
            },
            {
              name: "models/gemini-3.1-flash-lite",
              supportedGenerationMethods: ["generateContent"],
            },
          ],
        });
      assert.match(url, /models\/gemini-3.1-flash-lite:generateContent$/);
      return response(providerResult([question]));
    },
  });
  assert.equal(result.status, 200);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /\/models\?pageSize=1000$/);
});
test("automatic selection prefers stable Flash text models, respects supported methods and excludes other families", () => {
  const model = (name) => ({
    name: "models/" + name,
    supportedGenerationMethods: ["generateContent"],
  });
  assert.equal(
    selectFlashModel([
      model("gemini-4.0-flash-preview"),
      model("gemini-3.1-flash"),
      model("gemini-3.1-flash-lite"),
      model("gemini-2.5-flash-lite"),
    ]),
    "gemini-3.1-flash-lite",
  );
  assert.equal(
    selectFlashModel([
      model("gemini-3.1-pro"),
      model("gemini-3.1-flash-image"),
      {
        name: "models/gemini-3.1-flash",
        supportedGenerationMethods: ["embedContent"],
      },
    ]),
    undefined,
  );
});
test("model-list errors and empty results stop before generation with actionable diagnostics", async () => {
  let calls = 0;
  const env = {
    GEMINI_API_KEY: environment.GEMINI_API_KEY,
    RECALL_AI_MODEL: "auto",
  };
  const result = await invoke({
    env,
    fetchImpl: async () => {
      calls++;
      return response({ models: [] });
    },
  });
  assert.equal(result.data.code, "NO_AVAILABLE_MODEL");
  assert.equal(calls, 1);
  const denied = await invoke({
    env,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ error: { details: [{ reason: "API_KEY_INVALID" }] } }),
        { status: 400 },
      ),
  });
  assert.equal(denied.data.code, "API_KEY_INVALID");
});

test("normal quizzes prefer Flash Lite and avoid unnecessary thinking work", () => {
  const entry = (name) => ({
    name: "models/" + name,
    supportedGenerationMethods: ["generateContent"],
  });
  assert.equal(
    selectFlashModel([
      entry("gemini-3.1-flash"),
      entry("gemini-2.5-flash-lite"),
    ]),
    "gemini-2.5-flash-lite",
  );
  assert.deepEqual(generationSettings("gemini-2.5-flash", 10).thinkingConfig, {
    thinkingBudget: 0,
  });
  assert.deepEqual(
    generationSettings("gemini-3.1-flash-lite", 10).thinkingConfig,
    { thinkingLevel: "minimal" },
  );
  assert.equal(
    generationSettings("gemini-2.0-flash", 10).thinkingConfig,
    undefined,
  );
  assert.ok(
    generationSettings("gemini-2.5-flash-lite", 10).maxOutputTokens < 8192,
  );
});
test("warm requests reuse discovery while different API keys have separate model caches", async () => {
  let lookups = 0,
    generations = 0;
  const fetchImpl = async (url, options) => {
    if (options.method === "GET") {
      lookups++;
      return response({
        models: [
          {
            name: "models/gemini-3.1-flash-lite",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      });
    }
    generations++;
    return response(providerResult([question]));
  };
  const env = { GEMINI_API_KEY: "cache-test-key-not-real" };
  assert.equal((await invoke({ env, fetchImpl })).status, 200);
  assert.equal((await invoke({ env, fetchImpl })).status, 200);
  assert.equal(lookups, 1);
  assert.equal(generations, 2);
  assert.equal(
    (
      await invoke({
        env: { GEMINI_API_KEY: "another-cache-test-key-not-real" },
        fetchImpl,
      })
    ).status,
    200,
  );
  assert.equal(lookups, 2);
});

test("temporary provider failures retry once and can recover a real validated quiz", async () => {
  let calls = 0;
  const result = await invoke({
    fetchImpl: async () => {
      calls++;
      return calls === 1
        ? new Response(JSON.stringify({ error: { message: "Overloaded" } }), {
            status: 503,
          })
        : response(providerResult([question]));
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.status, 200);
  assert.equal(result.data.questions[0].accepted[0], question.answer);
});
test("transient retry stays bounded and persistent errors expose safe status and attempt count", async () => {
  let calls = 0;
  const result = await invoke({
    fetchImpl: async () => {
      calls++;
      return new Response(
        JSON.stringify({
          error: {
            message: "private-provider-message " + environment.GEMINI_API_KEY,
          },
        }),
        { status: 503 },
      );
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.status, 503);
  assert.equal(result.data.providerStatus, 503);
  assert.equal(result.data.attempts, 2);
  assert.match(result.data.error, /HTTP 503/);
  assert.match(result.data.error, /retry also failed/);
  assert.ok(!JSON.stringify(result.data).includes(environment.GEMINI_API_KEY));
});
test("retry observes provider retry-after and the original time budget", async () => {
  for (const [header, advance] of [
    ["30", 0],
    [null, 119000],
  ]) {
    let calls = 0,
      now = 0;
    const delays = [];
    const result = await fetchWithRetry(
      "https://example.test",
      {},
      {
        now: () => now,
        wait: async (n) => delays.push(n),
        fetchImpl: async () => {
          calls++;
          now += advance;
          return new Response("{}", {
            status: 503,
            headers: header ? { "retry-after": header } : {},
          });
        },
      },
    );
    assert.equal(calls, 1);
    assert.equal(result.attempts, 1);
    assert.deepEqual(delays, []);
  }
  let calls = 0;
  const delays = [];
  const result = await fetchWithRetry(
    "https://example.test",
    {},
    {
      wait: async (n) => delays.push(n),
      fetchImpl: async () => {
        calls++;
        return new Response("{}", { status: calls === 1 ? 502 : 200 });
      },
    },
  );
  assert.equal(calls, 2);
  assert.equal(result.response.status, 200);
  assert.deepEqual(delays, [750]);
});
test("quota errors, invalid requests and ambiguous network failures are not replayed", async () => {
  for (const status of [400, 401, 403, 404, 429]) {
    let calls = 0;
    const result = await fetchWithRetry(
      "https://example.test",
      {},
      {
        wait: async () => {
          throw new Error("must not wait");
        },
        fetchImpl: async () => {
          calls++;
          return new Response("{}", { status });
        },
      },
    );
    assert.equal(calls, 1);
    assert.equal(result.response.status, status);
  }
  let calls = 0;
  await assert.rejects(
    fetchWithRetry(
      "https://example.test",
      {},
      {
        fetchImpl: async () => {
          calls++;
          throw new TypeError("network error");
        },
      },
    ),
  );
  assert.equal(calls, 1);
  const result = await invoke({
    fetchImpl: async () => new Response("{}", { status: 418 }),
  });
  assert.equal(result.data.code, "UNEXPECTED_PROVIDER_RESPONSE");
  assert.match(result.data.error, /HTTP 418/);
});
