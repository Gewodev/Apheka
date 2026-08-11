import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import FloatingTimer from "./components/FloatingTimer";
import PdfViewerWindow from "./components/PdfViewerWindow";
import YouTubeFloatingPlayer from "./components/YouTubeFloatingPlayer";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary";

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
  ReactDOM.createRoot(rootEl).render(<YouTubeFloatingPlayer />);
} else {
  ReactDOM.createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
