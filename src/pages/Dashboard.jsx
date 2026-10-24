import { Link, useNavigate } from "react-router-dom";
import {
  Clock3,
  Layers,
  Flame,
  Target,
  ArrowUpRight,
  Plus,
  BookOpen,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import { useStore } from "../context";
import { PageHead, Empty } from "../components/UI";
import { isDue } from "../utils/spacedRepetition";
export default function Dashboard() {
  const { data } = useStore();
  const navigate = useNavigate();
  const reviews = data.cards.flatMap((c) => c.history),
    due = data.cards.filter((c) => isDue(c)).length;
  const today = new Date();
  const dayKey = (d) => new Date(d).toLocaleDateString("en-CA");
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return {
      name: d.toLocaleDateString("en", { weekday: "short" }),
      reviews: reviews.filter((r) => dayKey(r.at) === dayKey(d)).length,
    };
  });
  let streak = 0;
  const dates = new Set(reviews.map((r) => dayKey(r.at)));
  const day = new Date();
  if (!dates.has(dayKey(day))) day.setDate(day.getDate() - 1);
  while (dates.has(dayKey(day))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  const attempts = data.attempts || [];
  const avg = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)
    : null;
  const hour = today.getHours();
  return (
    <>
      <PageHead
        eyebrow="YOUR PERSONAL LEARNING SPACE"
        title={`Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, ready to learn?`}
        description="Keep your momentum going. Here’s your study overview."
      >
        <span className="date-chip">
          {today.toLocaleDateString("en", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </PageHead>
      <div className="hero">
        <div>
          <span className="pill">
            <Sparkles size={13} /> SMALL STEPS. LASTING KNOWLEDGE.
          </span>
          <h2>
            Your future self
            <br />
            will thank you.
          </h2>
          <p>
            A few focused minutes today can make all the difference.
            <br className="desktop" /> Let’s make something stick.
          </p>
          <Link className="button white-button" to="/flashcards">
            Start reviewing <ArrowRight size={17} />
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-card rear">
            <Layers size={30} />
          </div>
          <div className="art-card front">
            <span>recall.</span>
            <BookOpen size={55} />
            <i />
            <i />
          </div>
          <span className="art-spark">✧</span>
          <div className="mini-label">
            <span className="green-dot" /> A little better, every day
          </div>
        </div>
      </div>
      <div className="stats">
        {[
          [
            Clock3,
            "Total study hours",
            "—",
            "Focus timer arrives in a later phase",
          ],
          [
            Layers,
            "Cards due today",
            due,
            `${data.cards.length} cards in your library`,
          ],
          [
            Flame,
            "Study streak",
            `${streak} ${streak === 1 ? "day" : "days"}`,
            "Keep showing up for yourself",
          ],
          [
            Target,
            "Average quiz score",
            avg === null ? "—" : `${avg}%`,
            `${attempts.length} completed attempts`,
          ],
        ].map(([Icon, title, value, note]) => (
          <div className="stat" key={title}>
            <div className="row between">
              <span>{title}</span>
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-title">
            <h2>
              Today’s review <span className="count">{due}</span>
            </h2>
            <Link to="/flashcards" className="text-link">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          <p className="muted tiny">A little repetition goes a long way.</p>
          {data.decks
            .filter((d) =>
              data.cards.some((c) => c.deckId === d.id && isDue(c)),
            )
            .slice(0, 4)
            .map((d) => {
              const s = data.subjects.find((s) => s.id === d.subjectId);
              return (
                <Link
                  key={d.id}
                  to={`/flashcards?deck=${d.id}`}
                  className="review-row"
                >
                  <span
                    className="subject-icon"
                    style={{ color: s.color, background: `${s.color}18` }}
                  >
                    <Layers size={21} />
                  </span>
                  <div>
                    <h3>{d.name}</h3>
                    <span className="tiny muted">
                      {s.name} ·{" "}
                      {
                        data.cards.filter((c) => c.deckId === d.id && isDue(c))
                          .length
                      }{" "}
                      cards due
                    </span>
                  </div>
                  <ArrowRight size={17} />
                </Link>
              );
            })}
          {!due && (
            <Empty
              icon={Layers}
              title={
                data.cards.length
                  ? "You’re all caught up"
                  : "Your knowledge starts here"
              }
              description={
                data.cards.length
                  ? "Come back when your next review is due."
                  : "Create your first deck and make learning a habit."
              }
              action={data.cards.length ? undefined : "Create flashcards"}
              onClick={() => navigate("/flashcards")}
            />
          )}
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>Study activity</h2>
            <span className="date-chip tiny">This week</span>
          </div>
          <div className="row chart-total">
            <strong>{reviews.length}</strong>
            <span className="muted tiny">total card reviews</span>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: "#8b5cf610" }}
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                  }}
                />
                <Bar
                  dataKey="reviews"
                  name="Reviews"
                  fill="#8b5cf6"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={25}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="tiny muted">Actual review activity · last 7 days</p>
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>Recent subjects</h2>
            <Link className="text-link" to="/subjects">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          {data.subjects
            .slice(-3)
            .reverse()
            .map((s) => (
              <Link className="review-row" to={`/subjects/${s.id}`} key={s.id}>
                <span
                  className="subject-icon"
                  style={{ color: s.color, background: `${s.color}18` }}
                >
                  <BookOpen size={19} />
                </span>
                <div>
                  <h3>{s.name}</h3>
                  <span className="tiny muted">
                    {data.decks.filter((d) => d.subjectId === s.id).length}{" "}
                    decks
                  </span>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          {!data.subjects.length && (
            <Empty
              icon={BookOpen}
              title="A home for every subject"
              description="Organize your classes, topics, and big ideas."
            />
          )}
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>Quick actions</h2>
            <Sparkles size={17} className="muted" />
          </div>
          <div className="quick-grid">
            {[
              [
                "/flashcards",
                Layers,
                "Create flashcards",
                "Capture a new idea",
              ],
              ["/quizzes", Target, "Build a quiz", "From PDF or slides"],
              ["/subjects", Plus, "Add a subject", "Keep it organized"],
              [
                "/settings",
                DownloadIcon,
                "Back up your data",
                "Keep your work safe",
              ],
            ].map(([to, Icon, title, desc]) => (
              <Link className="quick-action" key={to} to={to}>
                <Icon size={19} />
                <strong>{title}</strong>
                <span>{desc}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <div className="footer-note">
        Made for your next “I remember this.” <Sparkles size={13} />
      </div>
    </>
  );
}
function DownloadIcon() {
  return <BookOpen size={19} />;
}
