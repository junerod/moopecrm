"use client";

import * as React from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "deskcomm-theme";

type ThemeContextValue = {
  /** User preference: light, dark, or system. */
  theme: Theme;
  /** Effective theme applied to the DOM (system collapsed to light/dark). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // localStorage indisponível (modo privado, sandbox) — segue com default.
  }
  return "light";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // O MESMO valor no SSR e no primeiro paint do client. Ler localStorage no
  // initializer trocava o ícone do ThemeToggle (Moon vs MonitorPlay) e o
  // React #418 em toda tela autenticada. O script no layout já pintou
  // `data-theme` no <html>; o React só alinha o estado DEPOIS de hidratar.
  // `hydrated` impede o applyTheme(dark) do 1º efeito de sobrescrever o
  // valor que o script já resolveu (light/system) — senão o F5 pisca escuro.
  const [theme, setThemeState] = React.useState<Theme>("dark");
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>("dark");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setThemeState(readStoredTheme());
    setSystemTheme(getSystemTheme());
    setHydrated(true);
  }, []);

  // Listener pra mudanças do prefers-color-scheme.
  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme === "light" ? "light" : "dark";

  // Aplica no DOM sempre que o tema efetivo muda — só depois de hidratar,
  // para não apagar o `data-theme` que o script anti-flash já pintou.
  React.useEffect(() => {
    if (!hydrated) return;
    applyTheme(resolvedTheme);
  }, [hydrated, resolvedTheme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistência opcional — falha silenciosamente.
    }
  }, []);

  const toggle = React.useCallback(() => {
    setThemeState((current) => {
      const currentResolved =
        current === "system" ? getSystemTheme() : current === "light" ? "light" : "dark";
      const next: Theme = currentResolved === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, toggle }),
    [theme, resolvedTheme, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>");
  }
  return ctx;
}
