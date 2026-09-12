import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TONS_DS, tomDaNav } from "@/lib/design-system/tones";

describe("tokens do design system MOOPE", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  it("declara identidade e superfícies sem hex espalhado na casca", () => {
    expect(css).toMatch(/--moope-primary:\s*#1677ff/);
    expect(css).toMatch(/--moope-navy:\s*#0b1f3a/);
    expect(css).toMatch(/--nav-bg:\s*#0b1f3a/);
    expect(css).toMatch(/--color-bg:\s*#f5f8fc/);
    expect(css).toMatch(/\[data-theme="dark"\][\s\S]*--color-bg:\s*#0b1220/);
    expect(css).toMatch(/--color-ai:/);
    expect(css).toMatch(/--nav-icon-cyan:\s*#12b8e8/);
    expect(css).toMatch(/--funnel-1:/);
    expect(css).toMatch(/\[data-theme="dark"\][\s\S]*--funnel-1:/);
  });

  it("mapeia ícones da nav por significado, não por enfeite", () => {
    expect(TONS_DS.length).toBeGreaterThanOrEqual(6);
    expect(tomDaNav("/app/inicio")).toBe("cyan");
    expect(tomDaNav("/app/inbox")).toBe("indigo");
    expect(tomDaNav("/app/kanban")).toBe("amber");
    expect(tomDaNav("/app/campanhas")).toBe("violet");
  });
});
