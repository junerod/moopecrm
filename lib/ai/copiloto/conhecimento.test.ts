import { describe, expect, it } from "vitest";

import { montarSystemComConhecimento } from "./conhecimento";
import { RASCUNHO_SEM_FONTE } from "./anti-alucinacao";

const overlay = { instruction: null, fieldKeys: [], fieldLabels: [] };

describe("montarSystemComConhecimento", () => {
  it("injeta só os trechos recuperados", () => {
    const s = montarSystemComConhecimento("BASE.", overlay, [
      { content: "Martelete Bosch 5kg. Locação mínima: 1 diária." },
    ]);
    expect(s).toMatch(/Martelete Bosch/);
    expect(s).toMatch(/não complete com suposição/i);
  });

  it("sem trecho manda admitir ausência", () => {
    const s = montarSystemComConhecimento("BASE.", overlay, []);
    expect(s).toContain(RASCUNHO_SEM_FONTE);
    expect(s).toMatch(/Não invente preço/);
  });
});
