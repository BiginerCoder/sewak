"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

function applyTheme(t: "light" | "dark") {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem("cn-theme", t);
  } catch {}
}

export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "row" }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  const toggle = () => {
    const next = dark ? "light" : "dark";
    applyTheme(next);
    setDark(!dark);
  };

  const icons = (
    <>
      <Moon size={18} className="theme-moon" aria-hidden />
      <Sun size={18} className="theme-sun" aria-hidden />
    </>
  );

  if (variant === "row") {
    return (
      <button
        type="button"
        className="nav-link"
        style={{ width: "100%", background: "none", border: 0, textAlign: "left" }}
        onClick={toggle}
        aria-pressed={dark}
        data-label="Toggle dark theme"
        aria-label="Dark theme"
      >
        {icons}
        <span className="nav-label">Dark theme</span>
      </button>
    );
  }
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-pressed={dark} aria-label="Dark theme" title="Toggle dark theme">
      {icons}
    </button>
  );
}
