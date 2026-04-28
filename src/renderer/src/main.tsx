import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Apply dark mode before first render to avoid flash
if (localStorage.getItem("theme") !== "light") {
  document.documentElement.classList.add("dark");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
