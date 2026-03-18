// client/src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/tokens.css";

// ✅ Ensure we only mount once
const el = document.getElementById("root");
if (!el) throw new Error("Missing #root");

if (!window.__APP_ROOT__) {
  window.__APP_ROOT__ = createRoot(el);
}

window.__APP_ROOT__.render(<App />);