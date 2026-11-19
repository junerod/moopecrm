import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MoopeConnectionClient } from "@/app/app/integrations/moope/_client";
import { GuiaIntegracaoMoope } from "@/app/app/integrations/moope/guia";
import { FONTES_DE_CONSULTA } from "@/lib/followup/graph-schema";
import { NAV_DESTINATIONS } from "@/lib/navigation/registry";
import { TOOLS_LOCADORA } from "@/lib/mcp/tools/catalogo/locadora";
import {
  EXEMPLOS_DE_PERGUNTA,
  PASSO_ASSISTENTE,
  PASSO_CONEXAO,
  PASSO_CREDENCIAL,
  PASSO_FILA,
  PASSO_HUMANO,
  exemplosCobremTodasAsFontes,
  ferramentasForaDoExemplo,
  ferramentasSoDoAtendente,
  rotuloVisivel,
} from "@/lib/moope/guia-integracao";

const HREFS = [PASSO_CONEXAO, PASSO_CREDENCIAL, PASSO_HUMANO, PASSO_FILA, PASSO_ASSISTENTE].map(
  (p) => p.href,
);

describe("guia da integração Moope", () => {
  it("cobre cada fonte do bloco Consultar gestão e cada ferramenta da locadora", () => {
    expect(exemplosCobremTodasAsFontes()).toBe(true);
    const vistas = new Set<string>([
      ...EXEMPLOS_DE_PERGUNTA.flatMap((e) => [e.ferramenta ?? "", ...(e.acompanha ?? [])]),
      ...ferramentasSoDoAtendente(),
      ...ferramentasForaDoExemplo(),
      "moope_get_atendimento",
    ]);
    for (const ferramenta of TOOLS_LOCADORA) {
      expect(vistas.has(ferramenta.name), ferramenta.name).toBe(true);
    }
    expect(ferramentasSoDoAtendente()).not.toContain("moope_consultar_disponibilidade");
    expect(ferramentasSoDoAtendente()).not.toContain("moope_listar_oferta");
  });

  it("cada caminho aponta para uma tela que está no menu", () => {
    const menu = new Set(NAV_DESTINATIONS.map((d) => d.href));
    for (const href of HREFS) {
      expect(menu.has(href), href).toBe(true);
    }
    for (const exemplo of EXEMPLOS_DE_PERGUNTA) {
      expect(menu.has(exemplo.passo.href), exemplo.id).toBe(true);
    }
  });

  it("mostra as duas portas, o exemplo do carro e o limite de lugares", () => {
    render(<GuiaIntegracaoMoope />);
    expect(screen.getByTestId("porta-bot").textContent).toMatch(/não gasta chave de IA/i);
    expect(screen.getByTestId("porta-assistente").textContent).toMatch(/Credenciais/);
    expect(screen.getByTestId("exemplo-oferta").textContent).toMatch(/Quais carros vocês têm disponível/);
    expect(screen.getByTestId("exemplo-oferta").textContent).toMatch(/cabem 5 pessoas/);
    const ligar = screen.getByTestId("como-ligar").textContent ?? "";
    expect(ligar).toMatch(/nasce já ligada/i);
    expect(ligar).toMatch(/já existe e ainda não está ligada/i);
    expect(ligar).toMatch(/Ligar agora/);
    expect(ligar).toMatch(/Não copie chave/);
    expect(ligar).toMatch(/não é o login da locadora/i);
    for (const fonte of FONTES_DE_CONSULTA) {
      expect(screen.getAllByText(rotuloVisivel(fonte)).length).toBeGreaterThan(0);
    }
  });
});

describe("aba na tela de integração", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: null }) })),
    );
  });

  it("abre os exemplos a partir da conexão", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MoopeConnectionClient />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("frota-sem-ligacao")).toBeTruthy();
    expect(screen.getByText(/Ajuste manual/).closest("details")?.open).toBe(false);
    await userEvent.click(screen.getByTestId("aba-como-usar"));
    expect(screen.getByTestId("guia-integracao-moope")).toBeTruthy();
    expect(screen.getByTestId("exemplo-oferta")).toBeTruthy();
  });

  it("mostra o endereço de onde a frota é lida", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: "cx",
            kind: "locadora",
            partner_webhook_url: "https://outro.exemplo/hooks",
            partner_api_url: "https://frotas.moope.com.br/empresa/9",
            inbound_key_prefix: "mop_aa",
            status: "active",
            public_url: "https://crm.exemplo",
          },
        }),
      })),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MoopeConnectionClient />
      </QueryClientProvider>,
    );
    const origem = await screen.findByTestId("frota-origem");
    expect(origem.textContent).toContain("https://frotas.moope.com.br/empresa/9");
    expect(origem.textContent).toMatch(/Ligar agora/);
  });
});
