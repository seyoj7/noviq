"use client";

import React, { useSyncExternalStore } from "react";

function subscribeTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getThemeSnapshot(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("noviq_theme");
  if (saved === "dark") return "dark";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function getThemeServerSnapshot(): "light" | "dark" {
  return "light";
}

export function ThemeToggle({
  style,
  className,
}: {
  style?: React.CSSProperties;
  className?: string;
}) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    if (nextTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("noviq_theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("noviq_theme", "light");
    }
    window.dispatchEvent(new Event("storage"));
  };

  const defaultStyle: React.CSSProperties = {
    position: "fixed",
    top: "80px",
    right: "24px",
    zIndex: 99,
    ...style,
  };

  return (
    <button
      id="theme-toggle"
      className={className || "btn btn-ghost btn-sm btn-icon"}
      title="Toggle theme"
      aria-label="Toggle dark mode"
      style={defaultStyle}
      onClick={toggleTheme}
    >
      {theme === "dark" ? (
        <svg
          id="theme-icon-sun"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      ) : (
        <svg
          id="theme-icon-moon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      )}
    </button>
  );
}
