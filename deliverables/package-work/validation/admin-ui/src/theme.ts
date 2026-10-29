import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
const key = "starstream-theme";
const eventName = "starstream-theme-changed";

export function readSavedTheme(): Theme {
  try { return localStorage.getItem(key) === "light" ? "light" : "dark"; }
  catch { return "dark"; }
}

export function setTheme(theme: Theme): boolean {
  document.documentElement.dataset.theme = theme;
  let saved = true;
  try { localStorage.setItem(key, theme); } catch { saved = false; }
  window.dispatchEvent(new Event(eventName));
  return saved;
}

function subscribe(callback: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      document.documentElement.dataset.theme = readSavedTheme();
      callback();
    }
  };
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", sync);
  return () => {
    window.removeEventListener(eventName, callback);
    window.removeEventListener("storage", sync);
  };
}

export function useTheme() {
  return useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "light" ? "light" : "dark");
}
