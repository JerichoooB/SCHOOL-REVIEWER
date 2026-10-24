import { useState } from "react";
import { Download, Smartphone, RefreshCw } from "lucide-react";
import { useInstall } from "../services/pwa";
import { Button } from "./UI";
export default function InstallApp() {
  const {
    prompt,
    setPrompt,
    installed,
    offlineReady,
    needRefresh,
    updateServiceWorker,
  } = useInstall();
  const [message, setMessage] = useState("");
  return (
    <section className="panel settings-panel">
      <h2 className="row">
        <Smartphone size={20} />
        Recall on your phone
      </h2>
      <p className="muted">
        {installed
          ? "Recall is running as an installed app."
          : "Install Recall on your home screen for a focused, app-like experience."}{" "}
        {offlineReady
          ? "Offline files are ready."
          : "Offline files are cached after opening the deployed app online."}
      </p>
      {!installed && (
        <>
          {prompt ? (
            <Button
              onClick={async () => {
                await prompt.prompt();
                const result = await prompt.userChoice;
                setMessage(
                  result.outcome === "accepted"
                    ? "Installation accepted. Follow your browser’s installation steps."
                    : "You can install later from your browser menu.",
                );
                setPrompt(null);
              }}
            >
              <Download size={16} />
              Install Recall
            </Button>
          ) : (
            <div className="install-instructions">
              <p>
                <strong>iPhone / iPad:</strong> Open in Safari, tap Share, then
                Add to Home Screen.
              </p>
              <p>
                <strong>Android:</strong> Open in Chrome, tap the ⋮ menu, then
                Install app or Add to Home screen.
              </p>
            </div>
          )}
          <p className="tiny muted">
            Installation requires HTTPS hosting. Data is local to this browser
            or installed app; devices do not sync. Keep backups before switching
            browsers or clearing site data. Document extraction works offline
            once cached.
          </p>
        </>
      )}
      {needRefresh && (
        <Button
          secondary
          onClick={() => {
            if (
              confirm(
                "Apply the app update? Finish and save any open drafts first.",
              )
            )
              updateServiceWorker(true);
          }}
        >
          <RefreshCw size={16} />
          Update available
        </Button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
