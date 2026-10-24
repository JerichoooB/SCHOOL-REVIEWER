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
import { grade } from "../utils/quizGrading";
import { generateAIQuiz } from "../services/aiQuiz";
export default function Quizzes() {
  const { data, update, setError } = useStore();
  const quizzes = data.quizzes || [];
  const [draft, setDraft] = useState(null),
    [busy, setBusy] = useState(false),
    [quiz, setQuiz] = useState(null),
    [answers, setAnswers] = useState({}),
    [started, setStarted] = useState(0),
    [result, setResult] = useState(null),
    [material, setMaterial] = useState(null),
    [passcode, setPasscode] = useState(""),
    [questionCount, setQuestionCount] = useState(10),
    [consent, setConsent] = useState(false);
  async function upload(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const sections = (await extractDocument(file)).filter((s) =>
        s.text.trim(),
      );
      const length = sections.reduce((n, s) => n + s.text.length, 0);
      if (length > 60000)
        throw new Error(
          "This document is too long for one AI quiz. Upload a smaller chapter (up to 60,000 extracted characters).",
        );
      setMaterial({
        sections,
        name: file.name.replace(/\.[^.]+$/, ""),
        fileName: file.name,
        length,
      });
      setConsent(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function generate(e) {
    e.preventDefault();
    if (busy || !consent) return;
    setBusy(true);
    try {
      const questions = await generateAIQuiz(
        material.sections,
        questionCount,
        passcode,
      );
      setDraft({
        id: crypto.randomUUID(),
        name: material.name.slice(0, 120),
        subjectId: data.subjects[0]?.id || "",
        fileName: material.fileName,
        generator: "gemini",
        questions,
      });
      setMaterial(null);
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
          Choose a PDF or PowerPoint. Let Gemini turn the key concepts into
          meaningful multiple-choice questions.
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
          PDF & PPTX · Up to 20 MB / 200 pages or slides · Short chapters work
          best
        </small>
        <p className="tiny muted">
          Text is extracted on your device. You choose when to send it to
          Gemini. Free-tier limits apply. Review AI drafts for accuracy. Scanned
          files need OCR; .ppt files need conversion.
        </p>
      </section>
      {material && (
        <section className="panel section-gap">
          <h2>Ready to make a better quiz?</h2>
          <p className="muted tiny">
            {material.fileName} · {material.sections.length} pages/slides ·{" "}
            {material.length.toLocaleString()} extracted characters. No content
            has been sent to Gemini yet.
          </p>
          <form onSubmit={generate}>
            <Field label="Number of questions">
              <select
                disabled={busy}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
              >
                {[3, 5, 10, 15].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Private generation passcode">
              <input
                type="password"
                required
                minLength={16}
                maxLength={512}
                autoComplete="off"
                disabled={busy}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="The private passcode you set in Vercel"
              />
            </Field>
            <label className="row consent-label">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy}
                onChange={(e) => setConsent(e.target.checked)}
              />
              Send this document’s extracted text to Google Gemini to generate
              my quiz.
            </label>
            <p className="muted tiny">
              Google’s unpaid API terms may allow submitted content to improve
              its products, depending on region/account. Avoid confidential
              material. Your API key stays on the server; this passcode is kept
              only in this tab’s memory.{" "}
              <a
                className="text-link"
                href="https://ai.google.dev/gemini-api/terms"
                target="_blank"
                rel="noreferrer"
              >
                Read Gemini terms
              </a>
            </p>
            <div className="row wrap section-gap">
              <Button
                type="submit"
                disabled={busy || !consent || passcode.length < 16}
              >
                {busy
                  ? "Gemini is writing your questions…"
                  : "Generate with Gemini"}
              </Button>
              <Button
                secondary
                type="button"
                disabled={busy}
                onClick={() => setMaterial(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </section>
      )}
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
                {q.type === "multiple_choice" ? (
                  <>
                    <div className="eyebrow">FOUR ANSWER CHOICES</div>
                    {q.options.map((option, index) => (
                      <Field key={index} label={`Option ${index + 1}`}>
                        <input
                          required
                          maxLength={500}
                          value={option}
                          onChange={(e) => {
                            const options = [...q.options];
                            options[index] = e.target.value;
                            changeQuestion(q.id, {
                              options,
                              accepted:
                                q.accepted[0] === option
                                  ? [e.target.value]
                                  : q.accepted,
                            });
                          }}
                        />
                      </Field>
                    ))}
                    <Field label="Correct answer">
                      <select
                        value={q.accepted[0]}
                        onChange={(e) =>
                          changeQuestion(q.id, { accepted: [e.target.value] })
                        }
                      >
                        {q.options.map((o, index) => (
                          <option key={index} value={o}>
                            {index + 1}. {o}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                ) : (
                  <>
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
                  </>
                )}
                <Field label="Source sentence / explanation">
                  <textarea
                    value={q.explanation}
                    onChange={(e) =>
                      changeQuestion(q.id, { explanation: e.target.value })
                    }
                  />
                </Field>
                {q.evidence && (
                  <blockquote className="source-quote">
                    <strong>{q.source} · Supporting quotation</strong>
                    <p>{q.evidence}</p>
                  </blockquote>
                )}
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
                  {q.evidence && (
                    <blockquote className="source-quote">
                      {q.evidence}
                    </blockquote>
                  )}
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
                Select the best answer for each multiple-choice question. Any
                short-answer questions use exact matching, ignoring case, extra
                spaces, and trailing punctuation.
              </p>
              {quiz.questions.map((q, i) =>
                q.type === "multiple_choice" ? (
                  <fieldset className="quiz-question" key={q.id}>
                    <legend>
                      {i + 1}. {q.prompt}
                    </legend>
                    {q.options.map((o, index) => (
                      <label
                        className={`quiz-option ${answers[q.id] === o ? "selected" : ""}`}
                        key={index}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={o}
                          checked={answers[q.id] === o}
                          onChange={() => setAnswers({ ...answers, [q.id]: o })}
                        />
                        <span className="option-letter">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span>{o}</span>
                      </label>
                    ))}
                  </fieldset>
                ) : (
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
                ),
              )}
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
