import { useEffect, useState } from "react";

/* Light, dark, or whatever the operating system says. The choice is kept per
   browser; the dark palette is the `.dark` block in ui/tokens.css, applied to
   <html>. */

export type ThemeChoice = "light" | "dark" | "system";

/* Light unless the user picks otherwise: the app never turns dark on its own.
   A new key, so a choice saved while "system" was the default starts light. */
const KEY = "ktda-bo.theme.v2";
const media = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);

export function storedTheme(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && !!media()?.matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** The current choice and a setter that applies and remembers it. While the
 *  choice is "system", a change in the OS setting repaints straight away. */
export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(storedTheme);

  useEffect(() => {
    applyTheme(choice);
    try {
      if (choice === "light") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, choice);
    } catch {
      /* storage unavailable: the choice lasts for this tab only */
    }
    if (choice !== "system") return;
    const m = media();
    if (!m) return;
    const follow = () => applyTheme("system");
    m.addEventListener("change", follow);
    return () => m.removeEventListener("change", follow);
  }, [choice]);

  return [choice, setChoice];
}
