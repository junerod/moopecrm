import { describe, expect, it } from "vitest";

import {
  capituloSugerido,
  ehCapituloDoManual,
  hrefComAjuda,
  hrefSemAjuda,
  rotuloDaTela,
} from "@/lib/manual/porta";

describe("porta do manual", () => {
  it("acrescenta e tira o parâmetro sem apagar o resto da query", () => {
    expect(hrefComAjuda("/app/modelos-prontos", "x=1", "modelos-prontos")).toBe(
      "/app/modelos-prontos?x=1&ajuda=modelos-prontos",
    );
    expect(hrefSemAjuda("/app/modelos-prontos", "x=1&ajuda=modelos-prontos")).toBe(
      "/app/modelos-prontos?x=1",
    );
    expect(hrefSemAjuda("/app/inbox", "ajuda=mensagens")).toBe("/app/inbox");
  });

  it("sugere o capítulo da tela em que a pessoa está", () => {
    expect(capituloSugerido("/app/modelos-prontos")).toBe("modelos-prontos");
    expect(capituloSugerido("/app/campanhas/nova")).toBe("campanhas");
    expect(capituloSugerido("/app/inbox")).toBe("mensagens");
    expect(ehCapituloDoManual("campanhas")).toBe(true);
    expect(ehCapituloDoManual("nao-existe")).toBe(false);
  });

  it("nomeia a tela para o botão Voltar", () => {
    expect(rotuloDaTela("/app/modelos-prontos")).toBe("Modelos prontos");
    expect(rotuloDaTela("/app/campanhas/nova")).toBe("Campanhas");
  });
});
