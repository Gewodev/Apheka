import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import FloatingTimer from "./components/FloatingTimer";
import FloatingNoteWindow from "./FloatingNoteWindow";
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

if (label === "floating-timer") {
  ReactDOM.createRoot(rootEl).render(<FloatingTimer />);
} else if (label === "youtube-player") {
  ReactDOM.createRoot(rootEl).render(<YouTubeFloatingPlayer />);
} else if (label === "floating-note-window") {
  ReactDOM.createRoot(rootEl).render(<FloatingNoteWindow />);
} else {
  ReactDOM.createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
