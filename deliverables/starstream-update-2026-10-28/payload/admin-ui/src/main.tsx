import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import "./responsive.css";
import "./theme.css";
import { readSavedTheme } from "./theme";

document.documentElement.dataset.theme = readSavedTheme();

const baseTitle = document.title;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App baseTitle={baseTitle} />
    </BrowserRouter>
  </React.StrictMode>
);
