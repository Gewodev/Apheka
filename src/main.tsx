import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import FloatingTimer from "./components/FloatingTimer";
import "./index.css";
import { AppProvider } from "./store/AppContext";

const isFloating = window.location.search.includes('window=timer');

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isFloating ? (
      <AppProvider>
        <FloatingTimer />
      </AppProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
