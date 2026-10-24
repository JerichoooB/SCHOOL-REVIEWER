import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus,
  Layers,
  ArrowRight,
  ArrowLeft,
  Shuffle,
  Pencil,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  Check,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { useStore } from "../context";
import { Button, Empty, Modal, Field, PageHead } from "../components/UI";
import { schedule, isDue } from "../utils/spacedRepetition";
import { download } from "../services/database";
import AIFlashcards from "../components/AIFlashcards";
import { useReviewClock } from "../hooks/useReviewClock";
export default function Flashcards() {
  const { data, update, prefs, setError } = useStore();
  const now = useReviewClock();
  const [generating, setGenerating] = useState(false);
  const [params, setParams] = useSearchParams();
  const deck = data.decks.find((d) => d.id === params.get("deck"));
  const [editing, setEditing] = useState(null),
    [cardEdit, setCardEdit] = useState(null),
    [search, setSearch] = useState(""),
    [session, setSession] = useState(null),
    [reviewed, setReviewed] = useState([]),
    [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [busy, setBusy] = useState(false);
  const cards = data.cards.filter((c) => c.deckId === deck?.id);
  const decks = data.decks.filter(
    (d) =>
      (!params.get("subject") || d.subjectId === params.get("subject")) &&
      d.name.toLowerCase().includes(search.toLowerCase()),
  );
  async function saveDeck(e) {
    e.preventDefault();
    const f = new FormData(e.target),
      record = {
        id: editing.id || crypto.randomUUID(),
        name: f.get("name").trim(),
        subjectId: f.get("subjectId"),
      };
    if (!record.name) return;
    try {
      await update((d) => ({
        ...d,
        decks: editing.id
          ? d.decks.map((x) => (x.id === record.id ? record : x))
          : [...d.decks, record],
      }));
      setEditing(null);
    } catch {}
  }
  async function saveCard(e) {
    e.preventDefault();
    const f = new FormData(e.target),
      record = {
        due: Date.now(),
        ease: 2.5,
        repetitions: 0,
        interval: 0,
        history: [],
        ...cardEdit,
        id: cardEdit.id || crypto.randomUUID(),
        deckId: deck.id,
        front: f.get("front").trim(),
        back: f.get("back").trim(),
        explanation: f.get("explanation").trim(),
        tags: f.get("tags").trim(),
        difficulty: f.get("difficulty"),
      };
    if (!record.front || !record.back) return;
    try {
      await update((d) => ({
        ...d,
        cards: cardEdit.id
          ? d.cards.map((x) => (x.id === record.id ? record : x))
          : [...d.cards, record],
      }));
      setCardEdit(null);
    } catch {}
  }
  async function remove(type, id) {
    if (
      !confirm(
        `Delete this ${type === "decks" ? "deck and all its cards" : "card"}? This cannot be undone.`,
      )
    )
      return;
    try {
      await update((d) => ({
        ...d,
        [type]: d[type].filter((x) => x.id !== id),
        cards:
          type === "decks"
            ? d.cards.filter((c) => c.deckId !== id)
            : d.cards.filter((c) => c.id !== id),
      }));
      if (type === "decks") setParams({});
    } catch {}
  }
  function start(d, dueOnly) {
    let list = data.cards
      .filter((c) => c.deckId === d.id && (!dueOnly || isDue(c, now)))
      .map((c) => c.id);
    if (prefs.shuffle)
      list = list
        .map((id) => ({ id, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map((x) => x.id);
    setSession(list);
    setReviewed([]);
    setIndex(0);
    setFlipped(false);
  }
  async function rate(r) {
    if (busy || !session?.[index]) return;
    setBusy(true);
    try {
      const id = session[index];
      await update((d) => ({
        ...d,
        cards: d.cards.map((c) => (c.id === id ? schedule(c, r) : c)),
      }));
      setReviewed((ids) => (ids.includes(id) ? ids : [...ids, id]));
      setIndex((i) => i + 1);
      setFlipped(false);
    } catch {
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!session || index >= session.length) return;
    function key(e) {
      if (e.repeat || e.target.matches("input,textarea,select") || busy) return;
      if (e.code === "Space" && !e.target.closest("button,a")) {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (flipped && ["1", "2", "3", "4"].includes(e.key))
        rate(["again", "hard", "good", "easy"][+e.key - 1]);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function importCards(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      let imported;
      if (file.name.toLowerCase().endsWith(".csv")) {
        imported = parseCSV(text);
        const headers = imported.shift();
        if (headers?.[0] !== "front" || headers?.[1] !== "back")
          throw new Error(
            "CSV must start with front,back,explanation,tags,difficulty.",
          );
        imported = imported.map((r) =>
          Object.fromEntries(headers.map((h, i) => [h, r[i] || ""])),
        );
      } else {
        const parsed = JSON.parse(text);
        imported = Array.isArray(parsed) ? parsed : parsed.cards;
      }
      if (
        !Array.isArray(imported) ||
        !imported.length ||
        !imported.every(
          (c) =>
            typeof c.front === "string" &&
            c.front.trim() &&
            c.front.length <= 10000 &&
            typeof c.back === "string" &&
            c.back.trim() &&
            c.back.length <= 10000,
        )
      )
        throw new Error(
          "Each imported card needs a front and back (up to 10,000 characters).",
        );
      const added = imported.map((c) => ({
        id: crypto.randomUUID(),
        deckId: deck.id,
        front: c.front.trim(),
        back: c.back.trim(),
        explanation: typeof c.explanation === "string" ? c.explanation : "",
        tags: typeof c.tags === "string" ? c.tags : "",
        difficulty: ["Easy", "Medium", "Hard"].includes(c.difficulty)
          ? c.difficulty
          : "Medium",
        due: Date.now(),
        ease: 2.5,
        repetitions: 0,
        interval: 0,
        history: [],
      }));
      await update((d) => ({ ...d, cards: [...d.cards, ...added] }));
    } catch (err) {
      setError(`Import failed: ${err.message}`);
    }
  }
  const active = data.cards.find((c) => c.id === session?.[index]);
  return (
    <>
      <PageHead
        eyebrow="A LITTLE PRACTICE, EVERY DAY"
        title={deck?.name || "Flashcards"}
        description={
          deck
            ? "Small steps toward lasting knowledge."
            : "Turn what you learn into what you remember."
        }
      >
        <Button
          onClick={() =>
            deck
              ? setCardEdit({ difficulty: "Medium" })
              : setEditing({
                  subjectId: params.get("subject") || data.subjects[0]?.id,
                })
          }
          disabled={!deck && !data.subjects.length}
        >
          <Plus size={17} />
          {deck ? "Add flashcard" : "Create deck"}
        </Button>
      </PageHead>
      {!data.subjects.length ? (
        <>
          <Empty
            icon={BookOpen}
            title="Start with a subject"
            description="Give your decks a home before adding your first flashcards."
          />
          <Link className="button" to="/subjects">
            Create a subject <ArrowRight size={16} />
          </Link>
        </>
      ) : (
        <>
          <div className="toolbar">
            {deck && (
              <button className="text-link" onClick={() => setParams({})}>
                <ArrowLeft size={16} />
                All decks
              </button>
            )}
            <input
              aria-label="Search flashcards or decks"
              placeholder={
                deck
                  ? "Search questions, answers, or tags…"
                  : "Search your decks…"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {deck && (
              <>
                <Button
                  secondary
                  onClick={() => start(deck, false)}
                  disabled={!cards.length}
                >
                  Study all
                </Button>
                <Button
                  onClick={() => start(deck, true)}
                  disabled={!cards.some((c) => isDue(c, now))}
                >
                  Review due cards
                </Button>
              </>
            )}
          </div>
          {!deck ? (
            <div className="subject-grid">
              {decks.map((d) => {
                const subject = data.subjects.find((s) => s.id === d.subjectId),
                  cs = data.cards.filter((c) => c.deckId === d.id),
                  due = cs.filter((c) => isDue(c, now)).length;
                return (
                  <article className="subject-card" key={d.id}>
                    <div className="row between">
                      <span
                        className="subject-icon"
                        style={{
                          color: subject.color,
                          background: `${subject.color}18`,
                        }}
                      >
                        <Layers />
                      </span>
                      <span className="badge">{due} due</span>
                    </div>
                    <button
                      className="subject-title"
                      onClick={() => {
                        setSearch("");
                        setParams({ deck: d.id });
                      }}
                    >
                      {d.name}
                      <ArrowRight size={17} />
                    </button>
                    <p>{subject.name}</p>
                    <div className="row between muted">
                      <span>{cs.length} cards</span>
                      <button
                        className="text-link"
                        disabled={!due}
                        onClick={() => start(d, true)}
                      >
                        Review <ArrowRight size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
              {!decks.length && (
                <Empty
                  icon={Layers}
                  title="Your next idea belongs here"
                  description="Create a deck and start building your knowledge, one card at a time."
                  action="Create a deck"
                  onClick={() =>
                    setEditing({ subjectId: data.subjects[0]?.id })
                  }
                />
              )}
            </div>
          ) : (
            <>
              <details className="study-help">
                <summary>New to flashcards?</summary>
                <p>
                  Read the question and try to answer from memory. Reveal the
                  answer, then choose Again, Hard, Good, or Easy. Recall
                  schedules your next review automatically. “Again” returns in
                  about a minute. You can write cards yourself or generate them
                  from your materials.
                </p>
              </details>
              <div className="row wrap deck-tools">
                <Button secondary onClick={() => setGenerating(true)}>
                  <Sparkles size={15} />
                  Generate with AI
                </Button>
                <Button secondary onClick={() => setEditing(deck)}>
                  <Pencil size={15} />
                  Edit deck
                </Button>
                <Button
                  secondary
                  onClick={() =>
                    download(
                      `${deck.name}.json`,
                      JSON.stringify({ cards }, null, 2),
                    )
                  }
                >
                  <Download size={15} />
                  JSON
                </Button>
                <Button
                  secondary
                  onClick={() =>
                    download(
                      `${deck.name}.csv`,
                      [
                        ["front", "back", "explanation", "tags", "difficulty"],
                        ...cards.map((c) => [
                          c.front,
                          c.back,
                          c.explanation,
                          c.tags,
                          c.difficulty,
                        ]),
                      ]
                        .map((r) =>
                          r
                            .map((v) => '"' + v.replaceAll('"', '""') + '"')
                            .join(","),
                        )
                        .join("\r\n"),
                      "text/csv",
                    )
                  }
                >
                  <Download size={15} />
                  CSV
                </Button>
                <label className="button secondary">
                  <Upload size={15} />
                  Import cards
                  <input
                    className="sr-only"
                    type="file"
                    accept=".json,.csv"
                    onChange={importCards}
                  />
                </label>
                <button
                  className="icon-button danger"
                  aria-label="Delete deck"
                  onClick={() => remove("decks", deck.id)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="card-list">
                {cards
                  .filter((c) =>
                    `${c.front} ${c.back} ${c.tags}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((c, i) => (
                    <article className="flashcard-row" key={c.id}>
                      <span className="card-number">{i + 1}</span>
                      <div>
                        <h3>{c.front}</h3>
                        <p>{c.back}</p>
                        {c.tags && <span className="tiny muted">{c.tags}</span>}
                        <div className="tiny muted">
                          {c.difficulty} ·{" "}
                          {isDue(c, now)
                            ? "Ready to review"
                            : `Due ${new Date(c.due).toLocaleDateString()}`}{" "}
                          · {c.history.length} reviews
                        </div>
                      </div>
                      <div className="row">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${c.front}`}
                          onClick={() => setCardEdit(c)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Delete ${c.front}`}
                          onClick={() => remove("cards", c.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
              {!cards.length && (
                <Empty
                  icon={Layers}
                  title="Every great deck starts with one card"
                  description="Add a question on the front and an answer on the back."
                  action="Add a flashcard"
                  onClick={() => setCardEdit({ difficulty: "Medium" })}
                />
              )}
            </>
          )}
        </>
      )}
      {generating && deck && (
        <AIFlashcards deck={deck} onClose={() => setGenerating(false)} />
      )}
      {editing && (
        <Modal
          title={editing.id ? "Edit deck" : "Create a flashcard deck"}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={saveDeck}>
            <Field label="Deck name">
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={editing.name}
                placeholder="e.g. Network fundamentals"
                autoFocus
              />
            </Field>
            <Field label="Subject">
              <select
                name="subjectId"
                defaultValue={editing.subjectId}
                required
              >
                {data.subjects.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit">Save deck</Button>
          </form>
        </Modal>
      )}
      {cardEdit && (
        <Modal
          title={
            cardEdit.id
              ? "Edit flashcard"
              : "Capture something worth remembering"
          }
          onClose={() => setCardEdit(null)}
        >
          <form onSubmit={saveCard}>
            <Field label="Front · question">
              <textarea
                name="front"
                defaultValue={cardEdit.front}
                maxLength={10000}
                required
                autoFocus
                placeholder="What do you want to remember?"
              />
            </Field>
            <Field label="Back · answer">
              <textarea
                name="back"
                defaultValue={cardEdit.back}
                maxLength={10000}
                required
                placeholder="Write a clear, concise answer"
              />
            </Field>
            <Field label="Explanation (optional)">
              <textarea
                name="explanation"
                maxLength={10000}
                defaultValue={cardEdit.explanation}
              />
            </Field>
            <div className="form-grid">
              <Field label="Tags (comma separated)">
                <input
                  name="tags"
                  maxLength={500}
                  defaultValue={cardEdit.tags}
                />
              </Field>
              <Field label="Difficulty">
                <select name="difficulty" defaultValue={cardEdit.difficulty}>
                  {["Easy", "Medium", "Hard"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Button type="submit">Save flashcard</Button>
          </form>
        </Modal>
      )}
      {session && (
        <Modal title="A moment to remember" onClose={() => setSession(null)}>
          {index >= session.length ? (
            <div className="empty">
              <span className="empty-icon">
                <Check />
              </span>
              <h2>One step closer to knowing it.</h2>
              <p>
                You reviewed {reviewed.length} cards.{" "}
                {session.length - reviewed.length} skipped cards keep their
                existing schedule.
              </p>
              <Button onClick={() => setSession(null)}>
                Back to your decks
              </Button>
            </div>
          ) : (
            <>
              <div className="row between muted tiny">
                <span>
                  Card {index + 1} of {session.length}
                </span>
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() => {
                    setSession((s) => [
                      ...s.slice(0, index),
                      ...s
                        .slice(index)
                        .map((id) => ({ id, r: Math.random() }))
                        .sort((a, b) => a.r - b.r)
                        .map((x) => x.id),
                    ]);
                    setFlipped(false);
                  }}
                >
                  <Shuffle size={14} />
                  Shuffle remaining
                </button>
              </div>
              <div className="progress">
                <i style={{ width: `${(index / session.length) * 100}%` }} />
              </div>
              <motion.button
                key={`${active?.id}-${flipped}`}
                initial={{ opacity: 0, rotateX: -8 }}
                animate={{ opacity: 1, rotateX: 0 }}
                className="study-card"
                disabled={busy}
                onClick={() => setFlipped(!flipped)}
              >
                <span className="eyebrow">
                  {flipped ? "THE ANSWER" : "THE QUESTION"}
                </span>
                <h2>{flipped ? active?.back : active?.front}</h2>
                {flipped && active?.explanation && <p>{active.explanation}</p>}
                {flipped && active?.source && (
                  <small className="muted">
                    {active.source}
                    {active.fileName ? ` · ${active.fileName}` : ""}
                  </small>
                )}
                <span className="muted tiny">
                  <RotateCcw size={13} />
                  Click or press Space to flip
                </span>
              </motion.button>
              {flipped ? (
                <div className="ratings">
                  {["again", "hard", "good", "easy"].map((r, i) => (
                    <button
                      disabled={busy}
                      key={r}
                      onClick={() => rate(r)}
                      className={`rating ${r}`}
                    >
                      {r}
                      <small>
                        {i + 1} ·{" "}
                        {r === "again"
                          ? "1 minute"
                          : `${schedule(active, r).interval} days`}
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <Button onClick={() => setFlipped(true)}>Reveal answer</Button>
              )}
              <div className="row between section-gap">
                <Button
                  secondary
                  disabled={busy || index === 0}
                  onClick={() => {
                    setIndex((i) => i - 1);
                    setFlipped(false);
                  }}
                >
                  <ArrowLeft size={15} />
                  Previous
                </Button>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => {
                    setIndex((i) => i + 1);
                    setFlipped(false);
                  }}
                >
                  Skip <ArrowRight size={15} />
                </Button>
              </div>
              <p className="tiny muted">
                Rate your recall to schedule your next review. Skipped cards
                stay due.
              </p>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
function parseCSV(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed CSV quotation.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
