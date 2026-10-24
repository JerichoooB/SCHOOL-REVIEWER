import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Plus,
  BookOpen,
  MoreHorizontal,
  Layers,
  ArrowUpRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { useStore } from "../context";
import { Button, Empty, Modal, Field, PageHead } from "../components/UI";
export default function Subjects() {
  const { data, update } = useStore(),
    { id } = useParams();
  const [editing, setEditing] = useState(null);
  const subject = data.subjects.find((s) => s.id === id);
  const list = id ? data.subjects.filter((s) => s.id === id) : data.subjects;
  async function save(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const record = {
      ...editing,
      id: editing.id || crypto.randomUUID(),
      name: f.get("name").trim(),
      description: f.get("description").trim(),
      color: f.get("color"),
      icon: f.get("icon"),
    };
    if (!record.name) return;
    try {
      await update((d) => ({
        ...d,
        subjects: editing.id
          ? d.subjects.map((s) => (s.id === record.id ? record : s))
          : [...d.subjects, record],
      }));
      setEditing(null);
    } catch {}
  }
  async function remove(s) {
    if (
      !confirm(
        `Delete “${s.name}” and all its decks, flashcards, and review history? This cannot be undone.`,
      )
    )
      return;
    try {
      await update((d) => {
        const decks = d.decks
          .filter((x) => x.subjectId === s.id)
          .map((x) => x.id);
        return {
          ...d,
          subjects: d.subjects.filter((x) => x.id !== s.id),
          decks: d.decks.filter((x) => !decks.includes(x.id)),
          cards: d.cards.filter((x) => !decks.includes(x.deckId)),
          quizzes: (d.quizzes || []).map((q) =>
            q.subjectId === s.id ? { ...q, subjectId: "" } : q,
          ),
        };
      });
    } catch {}
  }
  return (
    <>
      <PageHead
        eyebrow="YOUR KNOWLEDGE, ORGANIZED"
        title={subject?.name || "My subjects"}
        description={
          subject?.description || "A little structure. A lot more clarity."
        }
      >
        <Button onClick={() => setEditing({ color: "#8b5cf6" })}>
          <Plus size={17} />
          Add subject
        </Button>
      </PageHead>
      {id && !subject && (
        <Empty
          title="Subject not found"
          description="This subject may have been deleted."
        />
      )}
      <div className="subject-grid">
        {list.map((s) => {
          const decks = data.decks.filter((d) => d.subjectId === s.id),
            cards = data.cards.filter((c) =>
              decks.some((d) => d.id === c.deckId),
            ),
            reviews = cards.flatMap((c) => c.history),
            last = Math.max(0, ...reviews.map((r) => r.at)),
            mastered = cards.filter((c) => c.interval >= 21).length;
          return (
            <article className="subject-card" key={s.id}>
              <div className="row between">
                <span
                  className="subject-icon"
                  style={{ color: s.color, background: `${s.color}18` }}
                >
                  {s.icon || <BookOpen size={22} />}
                </span>
                <div className="row">
                  <button
                    className="icon-button"
                    aria-label={`Edit ${s.name}`}
                    onClick={() => setEditing(s)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${s.name}`}
                    onClick={() => remove(s)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <Link to={`/subjects/${s.id}`} className="subject-title">
                {s.name}
                <ArrowUpRight size={17} />
              </Link>
              <p>{s.description || "Your next chapter starts here."}</p>
              <div className="row muted">
                <Layers size={14} />
                {decks.length} decks<span>·</span>
                {cards.length} cards
              </div>
              <div className="progress">
                <i
                  style={{
                    width: `${cards.length ? (mastered / cards.length) * 100 : 0}%`,
                    background: s.color,
                  }}
                />
              </div>
              <div className="row between tiny muted">
                <span>{mastered} mastered</span>
                <span>
                  {last
                    ? `Studied ${new Date(last).toLocaleDateString()}`
                    : "Not studied yet"}
                </span>
              </div>
              <Link className="text-link" to={`/flashcards?subject=${s.id}`}>
                Explore decks <ArrowUpRight size={14} />
              </Link>
            </article>
          );
        })}
      </div>
      {!list.length && !id && (
        <Empty
          icon={BookOpen}
          title="Make room for what you’re learning"
          description="Create your first subject, then fill it with flashcard decks."
          action="Add your first subject"
          onClick={() => setEditing({ color: "#8b5cf6" })}
        />
      )}
      {subject && (
        <section className="panel section-gap">
          <h2>Related study tools</h2>
          <p>Explore this subject’s decks and review history in Flashcards.</p>
          <Link className="button" to={`/flashcards?subject=${subject.id}`}>
            Open flashcards <ArrowUpRight size={16} />
          </Link>
        </section>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Edit subject" : "A new space to learn"}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save}>
            <Field label="Subject name">
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={editing.name}
                placeholder="e.g. Computer Networking"
                autoFocus
              />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                maxLength={1000}
                defaultValue={editing.description}
                placeholder="What are you learning?"
              />
            </Field>
            <div className="form-grid">
              <Field label="Color">
                <input name="color" type="color" defaultValue={editing.color} />
              </Field>
              <Field label="Icon (optional emoji)">
                <input
                  name="icon"
                  maxLength={8}
                  defaultValue={editing.icon}
                  placeholder="📚"
                />
              </Field>
            </div>
            <Button type="submit">Save subject</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
