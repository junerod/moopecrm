import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { quantidadeDeModelos } from "@/hooks/ai/useCredentials";

describe("a validação não despeja catálogo de modelo na cara de quem opera", () => {
  it("array vira quantidade; nome nenhum aparece", () => {
    expect(quantidadeDeModelos(["gpt-4o", "whisper-1", "tts-1"])).toBe(3);
    expect(quantidadeDeModelos(12)).toBe(12);
    expect(quantidadeDeModelos(null)).toBeNull();
  });

  it("o toast de sucesso NÃO interpola models_available — isso junta cem ids com vírgula", () => {
    const fonte = readFileSync(
      join(process.cwd(), "app/app/ai/credentials/_components/AddCredentialDialog.tsx"),
      "utf8",
    );
    expect(fonte.includes("Credencial válida.")).toBe(true);
    expect(
      /Validada — \$\{[^}]*models_available/.test(fonte),
      "o toast voltou a imprimir a lista de modelos",
    ).toBe(false);
  });
});
