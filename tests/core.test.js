import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { schedule, isDue } from "../src/utils/spacedRepetition.js";
import { grade, draftQuestions } from "../src/utils/quizGrading.js";
import {
  emptyData,
  validateData,
  saveData,
  loadData,
} from "../src/services/database.js";
const card = {
  id: "card",
  deckId: "deck",
  front: "Question",
  back: "Answer",
  explanation: "",
  tags: "",
  difficulty: "Medium",
  due: 0,
  ease: 2.5,
  repetitions: 0,
  interval: 0,
  history: [],
};
test("SM-2 schedules learning, repeat successes, lapses, and minimum ease", () => {
  let c = schedule(card, "good", 1000);
  assert.equal(c.interval, 1);
  assert.equal(c.due, 86401000);
  c = schedule(c, "good", 2000);
  assert.equal(c.interval, 6);
  c = schedule(c, "good", 3000);
  assert.equal(c.interval, 15);
  c = schedule(c, "again", 4000);
  assert.equal(c.due, 64000);
  assert.equal(c.repetitions, 0);
  assert.equal(c.history.length, 4);
  for (let i = 0; i < 50; i++) c = schedule(c, "hard", 4000);
  assert.ok(c.ease >= 1.3);
  assert.ok(schedule(card, "easy", 0).interval >= 4);
  assert.equal(isDue(card, 100), true);
  assert.equal(isDue({ ...card, due: 200 }, 100), false);
  assert.throws(() => schedule(card, "bad"));
});
test("answer grading normalizes exact text, not semantic guesses", () => {
  assert.ok(grade("  PRIMARY   KEY. ", ["primary key"]));
  assert.ok(grade("TCP", ["transmission control protocol", "tcp"]));
  assert.ok(!grade("networking", ["network"]));
  assert.ok(!grade("", ["answer"]));
});
test("document drafts are grounded in source text and keep provenance", () => {
  const sentence =
    "A database organizes information into structured tables for efficient retrieval.";
  const qs = draftQuestions([{ source: "Page 3", text: sentence }]);
  assert.equal(qs.length, 1);
  assert.equal(qs[0].prompt.replace("________", qs[0].accepted[0]), sentence);
  assert.equal(qs[0].source, "Page 3");
  assert.equal(
    draftQuestions([{ source: "Slide 1", text: "Intro" }]).length,
    0,
  );
});
test("backup validation rejects dangling relationships and invalid records", () => {
  const d = {
    ...emptyData(),
    subjects: [
      { id: "subject", name: "Networks", description: "", color: "#8b5cf6" },
    ],
    decks: [{ id: "deck", name: "Basics", subjectId: "subject" }],
    cards: [card],
  };
  assert.equal(validateData(d), d);
  assert.throws(() => validateData({ ...d, subjects: [] }));
  assert.throws(() =>
    validateData({ ...d, cards: [{ ...card, due: "tomorrow" }] }),
  );
  assert.throws(() => validateData({ ...d, cards: [{ ...card, id: "deck" }] }));
  assert.throws(() =>
    validateData({
      ...d,
      quizzes: [{ id: "quiz", name: "Quiz", questions: [] }],
    }),
  );
});
test("IndexedDB writes survive reload; invalid writes preserve previous data", async () => {
  const d = {
    ...emptyData(),
    subjects: [
      {
        id: "subject",
        name: "Stored subject",
        description: "Persistent",
        color: "#a78bfa",
      },
    ],
  };
  await saveData(d);
  assert.deepEqual(await loadData(), d);
  await assert.rejects(
    saveData({
      ...d,
      decks: [{ id: "deck", name: "Invalid", subjectId: "missing" }],
    }),
  );
  assert.deepEqual(await loadData(), d);
});
