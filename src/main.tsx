import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installConsole } from "./lib/eggs/console";
import "./index.css";

// `wavelength` in the browser console lists the easter eggs.
installConsole();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
