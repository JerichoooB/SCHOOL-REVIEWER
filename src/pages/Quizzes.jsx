import { useState } from "react";
import {
  Upload,
  FileText,
  ArrowRight,
  Trash2,
  Pencil,
  Plus,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { useStore } from "../context";
import { PageHead, Button, Modal, Field, Empty } from "../components/UI";
import { extractDocument } from "../services/documents";
import { draftQuestions, grade } from "../utils/quizGrading";
export default function Quizzes() {
  const { data, update, setError } = useStore();
  const quizzes = data.quizzes || [];
  const [draft, setDraft] = useState(null),
    [busy, setBusy] = useState(false),
    [quiz, setQuiz] = useState(null),
    [answers, setAnswers] = useState({}),
    [started, setStarted] = useState(0),
    [result, setResult] = useState(null);
  async function upload(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const sections = await extractDocument(file),
        questions = draftQuestions(sections, 15);
      if (!questions.length)
        throw new Error(
          "No suitable sentences were found. Try a document with complete text sentences, or create a quiz manually.",
        );
      setDraft({
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ""),
        subjectId: data.subjects[0]?.id || "",
        fileName: file.name,
        questions,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    if (
      !draft.name.trim() ||
      !draft.questions.length ||
      !draft.questions.every(
        (q) => q.prompt.trim() && q.accepted.some((a) => a.trim()),
      )
    )
      return;
    try {
      await update((d) => ({
        ...d,
        quizzes: [...(d.quizzes || []).filter((q) => q.id !== draft.id), draft],
      }));
      setDraft(null);
    } catch {}
  }
  function start(q) {
    setQuiz(q);
    setAnswers({});
    setResult(null);
    setStarted(Date.now());
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const correct = quiz.questions.filter((q) =>
      grade(answers[q.id], q.accepted),
    ).length;
    const attempt = {
      id: crypto.randomUUID(),
      quizId: quiz.id,
      at: Date.now(),
      score: Math.round((correct / quiz.questions.length) * 100),
      correct,
      total: quiz.questions.length,
      seconds: Math.round((Date.now() - started) / 1000),
      answers,
    };
    try {
      await update((d) => ({
        ...d,
        attempts: [...(d.attempts || []), attempt],
      }));
      setResult(attempt);
    } catch {
    } finally {
      setBusy(false);
    }
  }
  function changeQuestion(id, patch) {
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  }
  return (
    <>
      <PageHead
        eyebrow="FROM YOUR NOTES TO KNOWLEDGE"
        title="Practice quizzes"
        description="Turn your PDFs and slides into a little daily practice."
      >
        <Button
          onClick={() =>
            setDraft({
              id: crypto.randomUUID(),
              name: "",
              subjectId: "",
              questions: [
                {
                  id: crypto.randomUUID(),
                  prompt: "",
                  accepted: [""],
                  explanation: "",
                  source: "Written by you",
                },
              ],
            })
          }
        >
          <Plus size={17} />
          Create quiz
        </Button>
      </PageHead>
      <section className="upload-zone">
        <span className="empty-icon">
          <Upload size={28} />
        </span>
        <h2>Your materials. Your next quiz.</h2>
        <p>
          Choose a PDF or PowerPoint to create editable fill-in-the-blank
          questions.
        </p>
        <label className={`button ${busy ? "disabled" : ""}`}>
          <Upload size={17} />
          {busy ? "Reading your document…" : "Choose PDF or PowerPoint"}
          <input
            disabled={busy}
            className="sr-only"
            type="file"
            accept=".pdf,.pptx"
            onChange={upload}
          />
        </label>
        <small>
          PDF & PPTX · Up to 20 MB / 200 pages or slides · Processed on your
          device
        </small>
        <p className="tiny muted">
          Local sentence-based generation, not AI. Review drafts for accuracy.
          Image-only files require OCR; legacy .ppt files need conversion.
        </p>
      </section>
      <div className="section-title section-gap">
        <h2>
          Your quizzes <span className="count">{quizzes.length}</span>
        </h2>
      </div>
      <div className="subject-grid">
        {quizzes.map((q) => {
          const attempts = (data.attempts || []).filter(
            (a) => a.quizId === q.id,
          );
          return (
            <article className="subject-card" key={q.id}>
              <div className="row between">
                <span className="subject-icon">
                  <FileText />
                </span>
                <div className="row">
                  <button
                    className="icon-button"
                    aria-label={`Edit ${q.name}`}
                    onClick={() => setDraft(structuredClone(q))}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${q.name}`}
                    onClick={async () => {
                      if (confirm("Delete this quiz and its attempt history?"))
                        try {
                          await update((d) => ({
                            ...d,
                            quizzes: d.quizzes.filter((x) => x.id !== q.id),
                            attempts: (d.attempts || []).filter(
                              (x) => x.quizId !== q.id,
                            ),
                          }));
                        } catch {}
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <h2>{q.name}</h2>
              <p>
                {q.questions.length} questions · {attempts.length} attempts
              </p>
              {q.fileName && <p className="tiny muted">Source: {q.fileName}</p>}
              <Button onClick={() => start(q)}>
                Start quiz <ArrowRight size={16} />
              </Button>
            </article>
          );
        })}
      </div>
      {!quizzes.length && (
        <Empty
          icon={FileText}
          title="Make your notes work for you"
          description="Upload a document or write your own questions to get started."
        />
      )}
      {draft && (
        <Modal title="Review your quiz draft" onClose={() => setDraft(null)}>
          <form onSubmit={save}>
            <p className="muted tiny">
              Check each question and answer against the original material. You
              can rewrite or remove any draft before saving.
            </p>
            <Field label="Quiz title">
              <input
                required
                maxLength={120}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Subject (optional)">
              <select
                value={draft.subjectId}
                onChange={(e) =>
                  setDraft({ ...draft, subjectId: e.target.value })
                }
              >
                <option value="">No subject</option>
                {data.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            {draft.questions.map((q, i) => (
              <section className="question-edit" key={q.id}>
                <div className="row between">
                  <span className="eyebrow">
                    QUESTION {i + 1} · {q.source}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove question ${i + 1}`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        questions: draft.questions.filter((x) => x.id !== q.id),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <Field label="Question">
                  <textarea
                    required
                    maxLength={10000}
                    value={q.prompt}
                    onChange={(e) =>
                      changeQuestion(q.id, { prompt: e.target.value })
                    }
                  />
                </Field>
                <Field label="Accepted answers (one per line)">
                  <textarea
                    required
                    value={q.accepted.join("\n")}
                    onChange={(e) =>
                      changeQuestion(q.id, {
                        accepted: e.target.value.split("\n"),
                      })
                    }
                  />
                </Field>
                <Field label="Source sentence / explanation">
                  <textarea
                    value={q.explanation}
                    onChange={(e) =>
                      changeQuestion(q.id, { explanation: e.target.value })
                    }
                  />
                </Field>
              </section>
            ))}
            <div className="row wrap">
              <Button
                secondary
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    questions: [
                      ...draft.questions,
                      {
                        id: crypto.randomUUID(),
                        prompt: "",
                        accepted: [""],
                        explanation: "",
                        source: "Written by you",
                      },
                    ],
                  })
                }
              >
                <Plus size={15} />
                Add question
              </Button>
              <Button disabled={!draft.questions.length} type="submit">
                Save reviewed quiz
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {quiz && (
        <Modal title={quiz.name} onClose={() => setQuiz(null)}>
          {result ? (
            <>
              <div className="quiz-score">
                <CheckCircle2 size={30} />
                <h2>{result.score}%</h2>
                <p>
                  {result.correct} correct · {result.total - result.correct}{" "}
                  incorrect · {result.seconds}s
                </p>
              </div>
              {quiz.questions.map((q, i) => (
                <div className="question-edit" key={q.id}>
                  <span
                    className={`badge ${grade(answers[q.id], q.accepted) ? "success" : "danger"}`}
                  >
                    {grade(answers[q.id], q.accepted) ? "Correct" : "Incorrect"}
                  </span>
                  <h3>
                    {i + 1}. {q.prompt}
                  </h3>
                  <p>Your answer: {answers[q.id] || "(blank)"}</p>
                  <p>Accepted: {q.accepted.join(" / ")}</p>
                  <p className="muted">{q.explanation}</p>
                  <small className="muted">{q.source}</small>
                </div>
              ))}
              <Button onClick={() => start(quiz)}>
                <RotateCcw size={16} />
                Try again
              </Button>
            </>
          ) : (
            <form onSubmit={submit}>
              <p className="muted tiny">
                Short answers use exact matching, ignoring case, extra spaces,
                and trailing punctuation.
              </p>
              {quiz.questions.map((q, i) => (
                <Field key={q.id} label={`${i + 1}. ${q.prompt}`}>
                  <input
                    value={answers[q.id] || ""}
                    onChange={(e) =>
                      setAnswers({ ...answers, [q.id]: e.target.value })
                    }
                    placeholder="Your answer"
                    autoComplete="off"
                  />
                </Field>
              ))}
              <Button disabled={busy} type="submit">
                Submit quiz
              </Button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
