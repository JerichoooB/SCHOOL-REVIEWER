import InstallApp from "../components/InstallApp";
import { useState } from "react";
import { Sun, Moon, Download, Upload, Trash2 } from "lucide-react";
import { useStore } from "../context";
import { PageHead, Button, Field } from "../components/UI";
import { download, validateData, emptyData } from "../services/database";
export default function Settings() {
  const { data, update, prefs, preferences, setError } = useStore();
  const [notice, setNotice] = useState("");
  async function restore(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = validateData(JSON.parse(await file.text()));
      if (
        !confirm(
          "Replace all current study data with this backup? Export your current data first.",
        )
      )
        return;
      await update(parsed);
      setNotice("Backup restored successfully.");
    } catch (e) {
      setError(`Restore failed: ${e.message}`);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="MAKE YOURSELF AT HOME"
        title="Settings"
        description="A study space that works your way."
      />
      <InstallApp />
      <section className="panel settings-panel">
        <h2>Appearance</h2>
        <p className="muted">Choose the light that helps you focus.</p>
        <div className="row">
          <Button
            secondary={prefs.theme === "light"}
            onClick={() => preferences({ theme: "dark" })}
          >
            <Moon size={17} />
            Dark
          </Button>
          <Button
            secondary={prefs.theme !== "light"}
            onClick={() => preferences({ theme: "light" })}
          >
            <Sun size={17} />
            Light
          </Button>
        </div>
      </section>
      <section className="panel settings-panel">
        <h2>Study preferences</h2>
        <label className="row">
          <input
            type="checkbox"
            checked={!!prefs.shuffle}
            onChange={(e) => preferences({ shuffle: e.target.checked })}
          />
          Shuffle cards when starting a review
        </label>
        <p className="muted tiny">
          Scheduling uses a simplified SM-2 algorithm. “Again” returns in 1
          minute; successful reviews grow from days to weeks.
        </p>
      </section>
      <section className="panel settings-panel">
        <h2>Your data, your control</h2>
        <p className="muted">
          Study data is stored in this browser. Export regular backups to keep
          it safe. Files are processed locally and are not uploaded to a server.
        </p>
        <div className="row wrap">
          <Button
            secondary
            onClick={() =>
              download(
                `recall-backup-${new Date().toISOString().slice(0, 10)}.json`,
                JSON.stringify(data, null, 2),
              )
            }
          >
            <Download size={17} />
            Export backup
          </Button>
          <label className="button secondary">
            <Upload size={17} />
            Restore backup
            <input
              className="sr-only"
              type="file"
              accept=".json"
              onChange={restore}
            />
          </label>
          <Button
            secondary
            onClick={async () => {
              if (
                confirm(
                  "Permanently delete all subjects, decks, cards, quizzes, and review history? Export a backup first.",
                )
              )
                try {
                  await update(emptyData());
                  setNotice("All study data has been reset.");
                } catch {}
            }}
          >
            <Trash2 size={17} />
            Reset all data
          </Button>
        </div>
        {notice && (
          <p role="status" className="success">
            {notice}
          </p>
        )}
      </section>
      <p className="muted tiny">
        Recall v1 · No account required · No external AI service
      </p>
    </>
  );
}
