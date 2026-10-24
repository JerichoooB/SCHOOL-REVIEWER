import { useEffect, useState } from "react";
import { Sparkles, Upload, Trash2 } from "lucide-react";
import { Modal, Button, Field } from "./UI";
import { extractDocument } from "../services/documents";
import { generateAIFlashcards } from "../services/aiQuiz";
import { useStore } from "../context";
const key = (front) => front.trim().toLowerCase().replace(/\s+/g, " ");
export default function AIFlashcards({ deck, onClose }) {
  const { update } = useStore();
  const [error, setError] = useState("");
  const [material, setMaterial] = useState(null),
    [cards, setCards] = useState([]),
    [count, setCount] = useState(10),
    [consent, setConsent] = useState(false),
    [phase, setPhase] = useState("choose"),
    [started, setStarted] = useState(null),
    [elapsed, setElapsed] = useState(0),
    [notice, setNotice] = useState("");
  const busy = ["reading", "generating", "saving"].includes(phase);
  useEffect(() => {
    if (!started) return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [started]);
  async function upload(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setPhase("reading");
    try {
      const sections = (await extractDocument(file)).filter((s) =>
        s.text.trim(),
      );
      const length = sections.reduce((n, s) => n + s.text.length, 0);
      if (length > 60000)
        throw new Error(
          "Choose a smaller chapter (up to 60,000 extracted characters).",
        );
      setMaterial({ sections, fileName: file.name, length });
      setConsent(false);
      setCards([]);
      setNotice("");
      setPhase("ready");
    } catch (e) {
      setError(e.message);
      setPhase(material ? "ready" : "choose");
    }
  }
  async function generate(e) {
    e.preventDefault();
    if (!consent || busy) return;
    setError("");
    setPhase("generating");
    setStarted(Date.now());
    setElapsed(0);
    try {
      setCards(await generateAIFlashcards(material.sections, count));
      setPhase("review");
    } catch (e) {
      setError(e.message);
      setPhase("ready");
    } finally {
      setStarted(null);
    }
  }
  function edit(id, field, value) {
    setCards((cs) =>
      cs.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  }
  async function save(e) {
    e.preventDefault();
    if (
      busy ||
      !cards.length ||
      cards.some((c) => !c.front.trim() || !c.back.trim())
    )
      return;
    setError("");
    setPhase("saving");
    let added = 0;
    try {
      await update((d) => {
        if (!d.decks.some((x) => x.id === deck.id))
          throw new Error("This deck was deleted. Choose another deck.");
        const seen = new Set(
          d.cards.filter((c) => c.deckId === deck.id).map((c) => key(c.front)),
        );
        const fresh = [];
        for (const c of cards) {
          const normalized = key(c.front);
          if (seen.has(normalized)) continue;
          seen.add(normalized);
          fresh.push({
            ...c,
            front: c.front.trim(),
            back: c.back.trim(),
            deckId: deck.id,
            fileName: material.fileName,
            tags: "",
            difficulty: "Medium",
            due: Date.now(),
            ease: 2.5,
            repetitions: 0,
            interval: 0,
            history: [],
          });
        }
        added = fresh.length;
        return { ...d, cards: [...d.cards, ...fresh] };
      });
      setNotice(
        `${added} flashcard${added === 1 ? "" : "s"} added to ${deck.name}. ${cards.length - added} duplicate${cards.length - added === 1 ? "" : "s"} skipped.`,
      );
      setPhase("done");
    } catch (error) {
      setError(error.message);
      setPhase("review");
    }
  }
  function close() {
    if (busy) {
      setError("Please wait for the current operation to finish.");
      return;
    }
    if (
      cards.length &&
      phase === "review" &&
      !confirm("Discard these unsaved flashcard drafts?")
    )
      return;
    onClose();
  }
  return (
    <Modal title="Make flashcards from your materials" onClose={close}>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {phase === "done" ? (
        <div className="empty">
          <span className="empty-icon">
            <Sparkles />
          </span>
          <h2>Ready to make it stick.</h2>
          <p role="status">{notice}</p>
          <Button onClick={onClose}>Back to your deck</Button>
        </div>
      ) : (
        <>
          <p className="muted tiny">
            Create focused question-and-answer cards from your PDF or slides.
            Review the drafts, then save them to <strong>{deck.name}</strong>.
          </p>
          {!["review", "saving"].includes(phase) && (
            <>
              <label
                className={`button secondary section-gap ${busy ? "disabled" : ""}`}
              >
                <Upload size={16} />
                {phase === "reading"
                  ? "Reading your document…"
                  : "Choose PDF or PowerPoint"}
                <input
                  className="sr-only"
                  type="file"
                  accept=".pdf,.pptx"
                  disabled={busy}
                  onChange={upload}
                />
              </label>
              <p className="muted tiny section-gap">
                PDF or PPTX · Up to 20 MB / 200 pages · Scanned files need OCR.
              </p>
            </>
          )}
          {material && !["review", "saving"].includes(phase) && (
            <form onSubmit={generate}>
              <p className="muted tiny section-gap">
                {material.fileName} · {material.length.toLocaleString()}{" "}
                characters. Text stays on this device until you generate.
              </p>
              <Field label="Number of flashcards">
                <select
                  disabled={busy}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {[3, 5, 10, 15].map((n) => (
                    <option value={n} key={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="row consent-label">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={busy}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Send this document’s extracted text to Google Gemini to generate
                flashcards.
              </label>
              <p className="muted tiny">
                Google’s unpaid API may use submitted content to improve its
                products, depending on your region/account. Avoid confidential
                material.{" "}
                <a
                  className="text-link"
                  href="https://ai.google.dev/gemini-api/terms"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read terms
                </a>
              </p>
              {phase === "generating" && (
                <p
                  className="muted tiny section-gap"
                  role="status"
                  aria-live="off"
                >
                  Writing flashcards · {elapsed}s elapsed. You can review every
                  answer before saving.
                </p>
              )}
              <Button type="submit" disabled={busy || !consent}>
                {phase === "generating"
                  ? "Writing your flashcards…"
                  : "Generate flashcards"}
              </Button>
            </form>
          )}
          {(phase === "review" || phase === "saving") && (
            <form onSubmit={save}>
              <p className="muted tiny section-gap">
                Check the answers against their source quotations. You can edit
                or remove any card. Existing cards and schedules won’t be
                replaced.
              </p>
              {cards.map((c, i) => (
                <section className="question-edit" key={c.id}>
                  <div className="row between">
                    <span className="eyebrow">
                      CARD {i + 1} · {c.source}
                    </span>
                    <button
                      disabled={busy}
                      type="button"
                      className="icon-button"
                      aria-label={`Remove draft card ${i + 1}`}
                      onClick={() =>
                        setCards((cs) => cs.filter((x) => x.id !== c.id))
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <Field label={`Card ${i + 1} question`}>
                    <textarea
                      required
                      maxLength={1000}
                      disabled={busy}
                      value={c.front}
                      onChange={(e) => edit(c.id, "front", e.target.value)}
                    />
                  </Field>
                  <Field label={`Card ${i + 1} answer`}>
                    <textarea
                      required
                      maxLength={2000}
                      disabled={busy}
                      value={c.back}
                      onChange={(e) => edit(c.id, "back", e.target.value)}
                    />
                  </Field>
                  <Field label={`Card ${i + 1} explanation`}>
                    <textarea
                      required
                      maxLength={2000}
                      disabled={busy}
                      value={c.explanation}
                      onChange={(e) =>
                        edit(c.id, "explanation", e.target.value)
                      }
                    />
                  </Field>
                  <blockquote className="source-quote">
                    <strong>{c.source} · Supporting quotation</strong>
                    <p>{c.evidence}</p>
                  </blockquote>
                </section>
              ))}
              <Button type="submit" disabled={busy || !cards.length}>
                {phase === "saving" ? "Saving…" : "Save reviewed flashcards"}
              </Button>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}
