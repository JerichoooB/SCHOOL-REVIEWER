export const emptyData = () => ({
  version: 1,
  subjects: [],
  decks: [],
  cards: [],
  quizzes: [],
  attempts: [],
});
const text = (x, max = 10000) =>
  typeof x === "string" && x.trim().length > 0 && x.length <= max;
export function validateData(data) {
  if (
    !data ||
    data.version !== 1 ||
    !["subjects", "decks", "cards"].every((k) => Array.isArray(data[k]))
  )
    throw new Error("Invalid Recall backup format.");
  const ids = new Set();
  for (const k of ["subjects", "decks", "cards"])
    for (const x of data[k]) {
      if (!x || !text(x.id, 100) || ids.has(x.id))
        throw new Error("Backup contains invalid or duplicate IDs.");
      ids.add(x.id);
    }
  for (const s of data.subjects)
    if (
      !text(s.name, 120) ||
      typeof s.description !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(s.color)
    )
      throw new Error("Invalid subject.");
  for (const d of data.decks)
    if (!text(d.name, 120) || !data.subjects.some((s) => s.id === d.subjectId))
      throw new Error("Invalid deck or missing subject.");
  for (const c of data.cards) {
    if (
      !text(c.front) ||
      !text(c.back) ||
      !data.decks.some((d) => d.id === c.deckId) ||
      !Number.isFinite(c.due) ||
      !Number.isFinite(c.ease) ||
      c.ease < 1.3 ||
      !Number.isInteger(c.repetitions) ||
      c.repetitions < 0 ||
      !Number.isFinite(c.interval) ||
      c.interval < 0 ||
      !Array.isArray(c.history) ||
      !c.history.every(
        (h) =>
          h &&
          Number.isFinite(h.at) &&
          ["again", "hard", "good", "easy"].includes(h.rating),
      ) ||
      typeof c.explanation !== "string" ||
      typeof c.tags !== "string" ||
      !["Easy", "Medium", "Hard"].includes(c.difficulty)
    )
      throw new Error("Invalid flashcard or review history.");
  }
  if (
    (data.quizzes !== undefined && !Array.isArray(data.quizzes)) ||
    (data.attempts !== undefined && !Array.isArray(data.attempts))
  )
    throw new Error("Invalid quizzes or attempts.");
  for (const q of data.quizzes || []) {
    if (
      !q ||
      !text(q.id, 100) ||
      ids.has(q.id) ||
      !text(q.name, 120) ||
      (q.subjectId && !data.subjects.some((s) => s.id === q.subjectId)) ||
      !Array.isArray(q.questions) ||
      !q.questions.length
    )
      throw new Error("Invalid quiz.");
    ids.add(q.id);
    for (const x of q.questions) {
      if (
        !x ||
        !text(x.id, 100) ||
        ids.has(x.id) ||
        !text(x.prompt) ||
        !Array.isArray(x.accepted) ||
        !x.accepted.length ||
        !x.accepted.every((a) => text(a)) ||
        typeof x.explanation !== "string" ||
        typeof x.source !== "string"
      )
        throw new Error("Invalid quiz question.");
      if (
        x.type !== undefined &&
        !["short_answer", "multiple_choice"].includes(x.type)
      )
        throw new Error("Unsupported quiz question type.");
      if (
        x.evidence !== undefined &&
        (typeof x.evidence !== "string" || x.evidence.length > 2000)
      )
        throw new Error("Invalid source quotation.");
      if (
        x.type === "multiple_choice" &&
        (!Array.isArray(x.options) ||
          x.options.length !== 4 ||
          !x.options.every((o) => text(o, 500)) ||
          new Set(
            x.options.map((o) => o.trim().toLowerCase().replace(/\s+/g, " ")),
          ).size !== 4 ||
          x.accepted.length !== 1 ||
          !x.options.includes(x.accepted[0]))
      )
        throw new Error(
          "Multiple-choice questions need four distinct options and one correct answer.",
        );
      ids.add(x.id);
    }
  }
  for (const a of data.attempts || []) {
    if (
      !a ||
      !text(a.id, 100) ||
      ids.has(a.id) ||
      !(data.quizzes || []).some((q) => q.id === a.quizId) ||
      !Number.isFinite(a.at) ||
      !Number.isFinite(a.score) ||
      a.score < 0 ||
      a.score > 100 ||
      !Number.isInteger(a.total) ||
      a.total < 1 ||
      !Number.isInteger(a.correct) ||
      a.correct < 0 ||
      a.correct > a.total ||
      !Number.isFinite(a.seconds) ||
      a.seconds < 0 ||
      !a.answers ||
      typeof a.answers !== "object" ||
      !Object.values(a.answers).every((x) => typeof x === "string")
    )
      throw new Error("Invalid quiz attempt.");
    ids.add(a.id);
  }
  return data;
}
let connection;
function db() {
  if (!connection)
    connection = new Promise((resolve, reject) => {
      const req = indexedDB.open("recall", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("state");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(
          new Error(
            "Could not open study storage. Please allow browser storage.",
          ),
        );
      req.onblocked = () =>
        reject(new Error("Close other Recall tabs to upgrade storage."));
    });
  return connection;
}
export async function loadData() {
  const conn = await db();
  return new Promise((resolve, reject) => {
    const req = conn.transaction("state").objectStore("state").get("data");
    req.onsuccess = () => {
      try {
        resolve(req.result ? validateData(req.result) : emptyData());
      } catch (e) {
        reject(e);
      }
    };
    req.onerror = () => reject(new Error("Could not read your study data."));
  });
}
export async function saveData(data) {
  validateData(data);
  const conn = await db();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction("state", "readwrite");
    tx.objectStore("state").put(data, "data");
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () =>
      reject(
        new Error(
          "Could not save. Browser storage may be full. Export a backup and try again.",
        ),
      );
  });
}
export function loadPreferences() {
  try {
    return JSON.parse(localStorage.getItem("recall.preferences")) || {};
  } catch {
    return {};
  }
}
export function savePreferences(p) {
  localStorage.setItem("recall.preferences", JSON.stringify(p));
}
export function download(name, content, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
