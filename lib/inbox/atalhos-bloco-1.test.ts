import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("atalhos do Bloco 1", () => {
  it("i foca nota interna; j/k/r/a/e/? continuam", () => {
    const fonte = readFileSync(join(__dirname, "../../components/inbox/InboxKeyboardShortcuts.tsx"), "utf8");
    expect(fonte).toContain('useHotkeys("i"');
    expect(fonte).toContain('useHotkeys("j"');
    expect(fonte).toContain('useHotkeys("k"');
    expect(fonte).toContain('useHotkeys("r"');
    expect(fonte).toContain('useHotkeys("a"');
    expect(fonte).toMatch(/useHotkeys\(\s*"e"/);
    expect(fonte).toContain('useHotkeys("shift+/"');
  });

  it("Cmd/Ctrl+Enter envia sem tirar o Enter", () => {
    const fonte = readFileSync(join(__dirname, "../../components/inbox/Composer.tsx"), "utf8");
    expect(fonte).toContain("e.metaKey || e.ctrlKey");
    expect(fonte).toContain('e.key === "Enter" && !e.shiftKey');
  });
});
