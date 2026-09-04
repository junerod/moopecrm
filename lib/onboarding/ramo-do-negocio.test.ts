import { describe, expect, it } from "vitest";

import { escolherPacotePorTexto } from "@/lib/onboarding/sugerir-funil";
import { RAMOS_DO_NEGOCIO, textoDoRamo } from "@/lib/onboarding/ramo-do-negocio";

describe("o ramo escolhido no primeiro passo vira o quadro certo", () => {
  it("locadora e advocacia casam com o pacote que o funil já conhece", () => {
    expect(escolherPacotePorTexto(textoDoRamo("locadora") ?? "").id).toBe("locadora");
    expect(escolherPacotePorTexto(textoDoRamo("advocacia") ?? "").id).toBe("advocacia");
  });

  it("outros sem detalhe não inventa ramo — o nome do negócio decide depois", () => {
    expect(textoDoRamo("outros")).toBeUndefined();
    expect(textoDoRamo("outros", "  ")).toBeUndefined();
    expect(textoDoRamo("outros", "Clínica odontológica")).toBe("Clínica odontológica");
  });

  it("as três portas existem e só elas", () => {
    expect(RAMOS_DO_NEGOCIO.map((r) => r.id)).toEqual(["locadora", "advocacia", "outros"]);
  });
});
