"use client";

import { useEffect, useRef, type ChangeEvent } from "react";

export default function ThemeToggle() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.checked = document.documentElement.dataset.theme === "light";
    }
  }, []);

  function updateTheme(event: ChangeEvent<HTMLInputElement>) {
    const theme = event.currentTarget.checked ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    document.cookie = `auction-theme=${theme}; Max-Age=31536000; Path=/; SameSite=Lax`;
  }

  return (
    <label className="theme-switch">
      <input
        ref={inputRef}
        aria-label="Light theme"
        defaultChecked={false}
        onChange={updateTheme}
        role="switch"
        type="checkbox"
      />
      <span aria-hidden="true" className="theme-switch-track">
        <span className="theme-switch-thumb" />
        <span className="theme-switch-option theme-switch-dark">Dark</span>
        <span className="theme-switch-option theme-switch-light">Light</span>
      </span>
    </label>
  );
}
