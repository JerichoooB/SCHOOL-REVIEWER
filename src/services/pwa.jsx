import { createContext, useContext, useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
const Context = createContext();
export const useInstall = () => useContext(Context);
export function PWAProvider({ children }) {
  const [prompt, setPrompt] = useState(null),
    [installed, setInstalled] = useState(
      window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone,
    );
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const before = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  return (
    <Context.Provider
      value={{
        prompt,
        setPrompt,
        installed,
        offlineReady,
        needRefresh,
        updateServiceWorker,
      }}
    >
      {children}
    </Context.Provider>
  );
}
