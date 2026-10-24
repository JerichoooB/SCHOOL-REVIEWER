import { useState } from "react";
import { NavLink, Link, Routes, Route, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  Target,
  Timer,
  ChartNoAxesCombined,
  CalendarDays,
  Settings as SettingsIcon,
  Search,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { useStore } from "./context";
import { Modal, PageHead, Button } from "./components/UI";
import Dashboard from "./pages/Dashboard";
import Subjects from "./pages/Subjects";
import Flashcards from "./pages/Flashcards";
import Quizzes from "./pages/Quizzes";
import Settings from "./pages/Settings";
const nav = [
  ["/", LayoutDashboard, "Dashboard"],
  ["/subjects", BookOpen, "My subjects"],
  ["/flashcards", Layers, "Flashcards"],
  ["/quizzes", Target, "Practice quizzes"],
  ["/sessions", Timer, "Study sessions"],
  ["/analytics", ChartNoAxesCombined, "Progress & analytics"],
  ["/planner", CalendarDays, "Study planner"],
];
export default function App() {
  const { data } = useStore();
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [query, setQuery] = useState(""),
    [creating, setCreating] = useState(false);
  const location = useLocation();
  const section =
    nav.find((n) =>
      n[0] === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(n[0]),
    )?.[2] || "Settings";
  const matching = query.trim().toLowerCase();
  const results = [
    ...data.subjects.map((s) => ({
      type: "Subjects",
      name: s.name,
      to: `/subjects/${s.id}`,
    })),
    ...data.decks.map((d) => ({
      type: "Decks",
      name: d.name,
      to: `/flashcards?deck=${d.id}`,
    })),
    ...data.cards.map((c) => ({
      type: "Flashcards",
      name: c.front,
      to: `/flashcards?deck=${c.deckId}`,
    })),
    ...(data.quizzes || []).map((q) => ({
      type: "Quizzes",
      name: q.name,
      to: "/quizzes",
    })),
  ].filter((r) => r.name.toLowerCase().includes(matching));
  return (
    <div className={`app ${collapsed ? "collapsed" : ""}`}>
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Link className="brand" to="/" onClick={() => setMobile(false)}>
          <span className="brand-icon">
            <Layers size={23} />
          </span>
          {!collapsed && (
            <span>
              recall<span className="brand-dot">.</span>
            </span>
          )}
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X />
        </button>
        <div className="workspace-label">
          {collapsed ? "YOU" : "YOUR WORKSPACE"}
        </div>
        <nav>
          {nav.map(([to, Icon, label]) => (
            <NavLink
              end={to === "/"}
              key={to}
              title={label}
              to={to}
              onClick={() => setMobile(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={19} />
              {!collapsed && <span>{label}</span>}
              {!collapsed && to === "/flashcards" && (
                <small>{data.cards.length}</small>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {!collapsed && (
            <div className="mindful-card">
              <Sparkles size={19} />
              <strong>Small steps. Big things.</strong>
              <p>Your next chapter starts with a little practice.</p>
              <Link to="/flashcards" onClick={() => setMobile(false)}>
                Let’s learn <ArrowUpRight size={14} />
              </Link>
            </div>
          )}
          <NavLink
            to="/settings"
            onClick={() => setMobile(false)}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <SettingsIcon size={19} />
            {!collapsed && "Settings"}
          </NavLink>
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <>
                <PanelLeftClose size={17} />
                Collapse sidebar
              </>
            )}
          </button>
          <Link to="/settings" className="profile">
            <span className="avatar">Y</span>
            {!collapsed && (
              <div>
                <strong>Your study space</strong>
                <small>Personal workspace</small>
              </div>
            )}
          </Link>
        </div>
      </aside>
      {mobile && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="header">
          <div className="row">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span> <strong>{section}</strong>
            </span>
          </div>
          <div className="header-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                aria-label="Search everything"
                placeholder="Search anything…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className="icon-button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X size={14} />
                </button>
              )}
              {matching && (
                <div className="search-results">
                  {results.slice(0, 15).map((r, i) => (
                    <Link
                      key={i}
                      to={r.to}
                      onClick={() => {
                        setQuery("");
                        setMobile(false);
                      }}
                    >
                      <small>{r.type}</small>
                      <span>{r.name}</span>
                      <ArrowUpRight size={14} />
                    </Link>
                  ))}
                  {!results.length && <p>No results for “{query}”</p>}
                </div>
              )}
            </div>
            <button
              className="button compact"
              onClick={() => setCreating(true)}
            >
              <Plus size={16} />
              <span>Quick create</span>
            </button>
            <Link
              to="/settings"
              className="avatar"
              aria-label="Open profile settings"
            >
              Y
            </Link>
          </div>
        </header>
        <main key={location.pathname}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/subjects" element={<Subjects />} />
            <Route path="/subjects/:id" element={<Subjects />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/quizzes" element={<Quizzes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route
              path="/sessions"
              element={
                <NextPhase
                  title="Study sessions"
                  description="A focused timer is planned for the next development phase. For now, build a review habit with your flashcards."
                />
              }
            />
            <Route
              path="/planner"
              element={
                <NextPhase
                  title="Study planner"
                  description="Calendar scheduling is planned for the next development phase. Organize your material into subjects and decks today."
                />
              }
            />
            <Route
              path="*"
              element={
                <NextPhase
                  title="Page not found"
                  description="This page doesn’t exist. Return to your dashboard to keep learning."
                />
              }
            />
          </Routes>
        </main>
      </div>
      {creating && (
        <Modal
          title="What will you learn next?"
          onClose={() => setCreating(false)}
        >
          <div className="create-choices">
            {[
              [
                "/subjects",
                BookOpen,
                "Add a subject",
                "Give your ideas a home",
              ],
              [
                "/flashcards",
                Layers,
                "Create flashcards",
                "Make something stick",
              ],
              [
                "/quizzes",
                Target,
                "Create a quiz",
                "Upload your PDF or slides",
              ],
            ].map(([to, Icon, title, desc]) => (
              <Link
                key={to}
                to={to}
                className="review-row"
                onClick={() => setCreating(false)}
              >
                <Icon />
                <div>
                  <h3>{title}</h3>
                  <span className="muted tiny">{desc}</span>
                </div>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
function NextPhase({ title, description }) {
  return (
    <>
      <PageHead
        eyebrow="ON THE HORIZON"
        title={title}
        description={description}
      />
      <section className="panel">
        <h2>Keep your momentum going</h2>
        <p className="muted">
          Subjects, flashcards, document-based quizzes, and backups are
          available now.
        </p>
        <Link to="/flashcards" className="button">
          Open flashcards <ArrowUpRight size={16} />
        </Link>
      </section>
    </>
  );
}
function Analytics() {
  const { data } = useStore();
  const reviews = data.cards.flatMap((c) => c.history),
    remembered = reviews.filter((r) => r.rating !== "again").length;
  return (
    <>
      <PageHead
        eyebrow="SEE HOW FAR YOU’VE COME"
        title="Progress & analytics"
        description="A clear look at your real study activity."
      />
      <div className="stats">
        {[
          ["Cards reviewed", reviews.length],
          [
            "Recall success",
            reviews.length
              ? `${Math.round((remembered / reviews.length) * 100)}%`
              : "—",
          ],
          ["Mastered cards", data.cards.filter((c) => c.interval >= 21).length],
          ["Quiz attempts", (data.attempts || []).length],
        ].map(([name, value]) => (
          <div key={name} className="stat">
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="panel section-gap">
        <h2>By subject</h2>
        {data.subjects.map((s) => {
          const decks = data.decks.filter((d) => d.subjectId === s.id);
          const cards = data.cards.filter((c) =>
            decks.some((d) => d.id === c.deckId),
          );
          return (
            <div className="review-row" key={s.id}>
              <span className="subject-icon" style={{ color: s.color }}>
                <BookOpen size={18} />
              </span>
              <div>
                <h3>{s.name}</h3>
                <p className="tiny muted">
                  {cards.length} cards ·{" "}
                  {cards.reduce((n, c) => n + c.history.length, 0)} reviews ·{" "}
                  {cards.filter((c) => c.interval >= 21).length} mastered
                </p>
              </div>
            </div>
          );
        })}
        {!data.subjects.length && (
          <p className="muted">
            Your progress will appear as you create subjects and review cards.
          </p>
        )}
        <p className="tiny muted">
          Mastered = review interval of at least 21 days. Recall success =
          ratings other than Again / all reviews. These measure self-reported
          recall.
        </p>
      </section>
    </>
  );
}
