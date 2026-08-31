import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ThemeToggle ramifica o ícone por `theme`. Se o provider lê localStorage
 * no initializer, o SSR manda MonitorPlay (system) e o client no 1º paint
 * manda Moon (dark) — React #418 em toda tela autenticada.
 */
describe("o tema não diverge entre SSR e o primeiro paint", () => {
  it("ThemeProvider nasce em system — readStoredTheme só depois de hidratar", () => {
    const src = readFileSync(join(process.cwd(), "lib/theme.tsx"), "utf8");
    expect(src).toMatch(/useState<Theme>\("system"\)/);
    expect(src).not.toMatch(/useState<Theme>\(\(\) => readStoredTheme/);
    expect(src).toMatch(/setThemeState\(readStoredTheme\(\)\)/);
  });
});
