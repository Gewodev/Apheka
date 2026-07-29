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
