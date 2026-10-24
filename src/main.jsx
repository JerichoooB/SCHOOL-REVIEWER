import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Store } from "./context";
import App from "./App";
import { PWAProvider } from "./services/pwa";
import "./index.css";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Store>
        <PWAProvider>
          <App />
        </PWAProvider>
      </Store>
    </BrowserRouter>
  </React.StrictMode>,
);
