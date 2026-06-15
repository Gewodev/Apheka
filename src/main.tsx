import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import FloatingTimer from "./components/FloatingTimer";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary";

function isFloating(): boolean {
  try {
    const i = (window as any).__TAURI_INTERNALS__;
    return i?.metadata?.currentWindow?.label === "floating-timer";
  } catch {
    return false;
  }
}

const rootEl = document.getElementById("root") as HTMLElement;

if (isFloating()) {
  ReactDOM.createRoot(rootEl).render(<FloatingTimer />);
} else {
  ReactDOM.createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
