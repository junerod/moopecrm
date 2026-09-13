import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("tema light / dark / system persiste de verdade", () => {
  it("o script anti-flash lê a preferência — não grava dark à força", () => {
    const src = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(src).toMatch(/data-theme="light"/);
    expect(src).not.toMatch(/<html[\s\S]*data-theme="dark"/);
    expect(src).toMatch(/deskcomm-theme-light-default/);
    expect(src).toMatch(/localStorage\.setItem\(k,'light'\)/);
    expect(src).not.toMatch(/localStorage\.setItem\([^)]*'dark'/);
    expect(src).toMatch(/t!=='light'&&t!=='dark'&&t!=='system'/);
  });

  it("ThemeProvider só aplica data-theme depois de hidratar", () => {
    const src = readFileSync(join(process.cwd(), "lib/theme.tsx"), "utf8");
    expect(src).toMatch(/if \(!hydrated\) return/);
    expect(src).toMatch(/useState<Theme>\("light"\)/);
    expect(src).toMatch(/THEME_LIGHT_DEFAULT_FLAG/);
    expect(src).toMatch(/return "light"/);
  });

  it("o controle da topbar oferece Claro, Escuro e Sistema", () => {
    const src = readFileSync(join(process.cwd(), "components/theme/theme-toggle.tsx"), "utf8");
    expect(src).toMatch(/data-testid="theme-control"/);
    expect(src).toMatch(/theme-option-\$\{o\.valor\}/);
    expect(src).toMatch(/Claro/);
    expect(src).toMatch(/Escuro/);
    expect(src).toMatch(/Sistema/);
  });
});
