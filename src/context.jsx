import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  emptyData,
  loadData,
  saveData,
  loadPreferences,
  savePreferences,
} from "./services/database";
const Context = createContext();
export const useStore = () => useContext(Context);
export function Store({ children }) {
  const [data, setData] = useState(emptyData),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [prefs, setPrefs] = useState(loadPreferences),
    [fatal, setFatal] = useState(false);
  const current = useRef(data),
    queue = useRef(Promise.resolve());
  useEffect(() => {
    loadData()
      .then((d) => {
        current.current = d;
        setData(d);
        setReady(true);
      })
      .catch((e) => {
        setError(e.message);
        setFatal(true);
      });
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme || "dark";
  }, [prefs]);
  const update = (fn) => {
    const task = queue.current.then(async () => {
      const next = typeof fn === "function" ? fn(current.current) : fn;
      await saveData(next);
      current.current = next;
      setData(next);
    });
    queue.current = task.catch((e) => setError(e.message));
    return task;
  };
  const preferences = (p) => {
    const next = { ...prefs, ...p };
    try {
      savePreferences(next);
      setPrefs(next);
    } catch {
      setError("Could not save preferences. Please enable browser storage.");
    }
  };
  return (
    <Context.Provider
      value={{ data, update, prefs, preferences, error, setError }}
    >
      {error && (
        <div role="alert" className="error-toast">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {ready ? (
        children
      ) : (
        <div className="loading">
          {fatal
            ? "Your data could not be loaded. Reload after resolving the storage error."
            : "Opening your study space…"}
        </div>
      )}
    </Context.Provider>
  );
}
