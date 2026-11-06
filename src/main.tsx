import './session-polish.css';
import './scroll-surfaces.css';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import FloatingTimer from "./components/FloatingTimer";
import PdfViewerWindow from "./components/PdfViewerWindow";
import {invoke,isTauri} from "@tauri-apps/api/core";
import {retireMediaState} from "./lib/retiredMedia";
import "./fonts.css";
import "./index.css";
import "./apheka.css";
import "./workspace.css";
import "./refinement.css";
import "./desktop.css";
import "./studio.css";
import "./quiet.css";
import "./interface.css";
import "./interaction-refinement.css";
import "./workspace-622.css";
import './input-polish.css';
import ErrorBoundary from "./components/ErrorBoundary";

// Parche global anti-cuota: NINGÚN localStorage.setItem de la app puede volver
// a tumbar una vista ("exceeded the quota"). Ante cuota llena se libera lastre
// (timestamps de notificaciones, log de errores, historiales de notas) y se
// reintenta una vez; si ni así cabe, el guardado se omite en silencio.
try {
  const rawSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k: string, v: string) {
    try {
      rawSet.call(this, k, v);
      return;
    } catch { /* cuota u otro fallo: liberar lastre y reintentar */ }
    try {
      for (let i = this.length - 1; i >= 0; i--) {
        const key = this.key(i);
        if (key && key.indexOf('owa_notif_ts_') === 0) { try { this.removeItem(key); } catch { /* noop */ } }
      }
      try {
        const raw = this.getItem('owa_error_log_v1');
        const arr = JSON.parse(raw || '[]');
        if (Array.isArray(arr) && arr.length > 3) rawSet.call(this, 'owa_error_log_v1', JSON.stringify(arr.slice(-3)));
      } catch { try { this.removeItem('owa_error_log_v1'); } catch { /* noop */ } }
    } catch { /* noop */ }
    try {
      rawSet.call(this, k, v);
    } catch { /* sin espacio: se omite el guardado, la app sigue viva */ }
  };
} catch { /* noop */ }

function getWindowLabel(): string {
  try {
    const i = (window as any).__TAURI_INTERNALS__;
    return i?.metadata?.currentWindow?.label || "";
  } catch {
    return "";
  }
}

const rootEl = document.getElementById("root") as HTMLElement;
const label = getWindowLabel();
retireMediaState();
// Retired windows never mount an iframe or restore pending playback.
if (isTauri()) void invoke("retire_legacy_media_windows").catch(()=>{});

try {
  const ERROR_LOG_KEY = "owa_error_log_v1";
  const logErr = (kind: string, message: string, stack?: string) => {
    try {
      const prev = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || "[]");
      prev.push({ at: new Date().toISOString(), kind, message, stack: stack || "", href: window.location.hash || "" });
      localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(prev.slice(-10)));
    } catch { /* noop */ }
  };
  window.addEventListener("error", (e) => logErr("window", e.message || String(e.error), e.error?.stack));
  window.addEventListener("unhandledrejection", (e) => logErr("promise", String(e.reason?.message || e.reason), e.reason?.stack));
} catch { /* noop */ }

if (label === "floating-timer") {
  ReactDOM.createRoot(rootEl).render(<FloatingTimer />);
} else if (label === "pdf-viewer") {
  ReactDOM.createRoot(rootEl).render(<PdfViewerWindow />);
} else if (label === "youtube-player") {
  rootEl.replaceChildren();
} else {
  ReactDOM.createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
