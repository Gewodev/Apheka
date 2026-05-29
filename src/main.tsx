import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import FloatingTimer from "./components/FloatingTimer";
import "./index.css";
import { AppProvider } from "./store/AppContext";
import ErrorBoundary from "./components/ErrorBoundary";

const isFloating = window.location.search.includes('window=timer');

function FloatingApp() {
  return (
    <AppProvider>
      <FloatingTimer />
    </AppProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ErrorBoundary>
    {isFloating ? <FloatingApp /> : <App />}
  </ErrorBoundary>,
);
