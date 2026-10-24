import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../api/generate-quiz.js";
import { validateQuestions, validateInput } from "../server/aiQuiz.js";
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
