import { describe, expect, it } from "vitest";

import { fichaDaEmpresaSchema } from "@/lib/schemas/settings";
import {
  iniciaisDoNome,
  lerEmpresaDoSettings,
  mesclarSettingsEmpresa,
} from "@/lib/negocio/ficha";

describe("mesclarSettingsEmpresa", () => {
  it("não apaga branding nem crm", () => {
    const next = mesclarSettingsEmpresa(
      {
        branding: { app_name: "X" },
        crm: { inbound_pipeline_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
        lost_reasons_extra: ["Sem orçamento"],
        ai_mode: "off",
      },
      { telefone: "5561999", site: "https://ex.com", endereco: "Asa Sul" },
    );
    expect(next.branding).toEqual({ app_name: "X" });
    expect(next.crm).toEqual({ inbound_pipeline_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    expect(next.lost_reasons_extra).toEqual(["Sem orçamento"]);
    expect(next.ai_mode).toBe("off");
    expect(next.empresa).toEqual({
      telefone: "5561999",
      site: "https://ex.com",
      endereco: "Asa Sul",
    });
  });
});

describe("lerEmpresaDoSettings", () => {
  it("settings sem empresa devolve vazio, não lixo", () => {
    expect(lerEmpresaDoSettings({ branding: { app_name: "X" } })).toEqual({
      telefone: null,
      site: null,
      endereco: null,
    });
  });
});

describe("fichaDaEmpresaSchema", () => {
  it("site sem http é recusado; vazio vira null", () => {
    expect(
      fichaDaEmpresaSchema.safeParse({
        display_name: "Moope",
        legal_name: "Moope LTDA",
        cnpj: "",
        empresa: { telefone: "", site: "moope.com", endereco: "" },
      }).success,
    ).toBe(false);
    const ok = fichaDaEmpresaSchema.parse({
      display_name: "Moope",
      legal_name: "Moope LTDA",
      cnpj: "",
      empresa: { telefone: "", site: "", endereco: "" },
    });
    expect(ok.cnpj).toBeNull();
    expect(ok.empresa.site).toBeNull();
  });
});

describe("iniciaisDoNome", () => {
  it("pega primeira e última palavra", () => {
    expect(iniciaisDoNome("Rodrigues Advogados")).toBe("RA");
    expect(iniciaisDoNome("Moope")).toBe("MO");
  });
});
