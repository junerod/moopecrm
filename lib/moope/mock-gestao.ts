/**
 * Mock oficial isolado da Gestão — contrato read-only do Bridge.
 * Não é a Gestão de produção. Serve o self-test e os testes de contrato.
 */
import { createHmac } from "node:crypto";

export const MOCK_GESTAO_SECRET = "mock-gestao-hmac-self-test";
export const MOCK_LOCATARIO_ID = "loc-selftest-1";

const CLIENTE = {
  locatario_id: MOCK_LOCATARIO_ID,
  nome: "Ana Locatária",
  telefone: "+5511999887766",
  contrato_status: "ativo",
};

function assinar(canonical: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(canonical).digest("hex")}`;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function fetchMockGestao(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts: { secret?: string; verificarHmac?: boolean } = {},
): Promise<Response> {
  const secret = opts.secret ?? MOCK_GESTAO_SECRET;
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input));
  if (opts.verificarHmac !== false) {
    const canonical = `GET\n${url.pathname}${url.search}`;
    const esperado = assinar(canonical, secret);
    const recebido = new Headers(init?.headers).get("X-Moope-Signature") ?? "";
    if (recebido !== esperado) return Promise.resolve(json(401, { error: "hmac" }));
  }

  if (url.pathname === "/api/crm/locatario") {
    const phone = url.searchParams.get("phone") ?? "";
    const external = url.searchParams.get("external_id") ?? "";
    if (phone.endsWith("0000")) return Promise.resolve(json(404, { error: "nao_encontrado" }));
    if (phone.endsWith("1111")) return Promise.resolve(json(409, { error: "ambiguo" }));
    if (external && external !== MOCK_LOCATARIO_ID && external !== "ext-1") {
      return Promise.resolve(json(404, { error: "nao_encontrado" }));
    }
    return Promise.resolve(json(200, { data: CLIENTE }));
  }

  if (url.pathname === `/api/crm/locatario/${MOCK_LOCATARIO_ID}/retrato`) {
    return Promise.resolve(json(200, {
      data: {
        ...CLIENTE,
        placa: "ABC1D23",
        veiculo_modelo: "Onix",
        contrato_titulo: "Contrato 128",
        faixa: "em_dia",
        amount_cents: 0,
        days_late: 0,
        boleto_url: "https://gestao.exemplo/boleto/128",
        pix_url: "https://gestao.exemplo/pix/128",
        portal_url: "https://gestao.exemplo/portal/128",
        documentos: ["CNH"],
        pode: ["segunda_via"],
      },
    }));
  }

  if (url.pathname === `/api/crm/locatario/${MOCK_LOCATARIO_ID}/locacoes`) {
    return Promise.resolve(json(200, {
      data: [{
        locacao_id: "locacao-1",
        status: "ativo",
        inicio: "2026-09-01",
        termino: "2026-09-15",
        veiculo: "Onix",
        valor: 1800,
        renovacao: null,
      }],
    }));
  }

  if (url.pathname === `/api/crm/locatario/${MOCK_LOCATARIO_ID}/financeiro`) {
    return Promise.resolve(json(200, {
      data: [{ parcela_id: "parc-1", vencimento: "2026-09-10", valor: 900, status: "pago", atraso_dias: 0 }],
      boleto_url: "https://gestao.exemplo/boleto/128",
      pix_url: "https://gestao.exemplo/pix/128",
      portal_url: "https://gestao.exemplo/portal/128",
    }));
  }

  if (url.pathname === `/api/crm/locatario/${MOCK_LOCATARIO_ID}/segunda-via`) {
    return Promise.resolve(json(200, {
      data: {
        boleto_url: "https://gestao.exemplo/boleto/128",
        pix_url: "https://gestao.exemplo/pix/128",
        portal_url: "https://gestao.exemplo/portal/128",
      },
    }));
  }

  if (url.pathname === `/api/crm/locatario/${MOCK_LOCATARIO_ID}/manutencao`) {
    return Promise.resolve(json(200, { data: [{ data: "2026-08-20", descricao: "Revisão preventiva", status: "concluida" }] }));
  }
  if (url.pathname === `/api/crm/locatario/${MOCK_LOCATARIO_ID}/multas`) {
    return Promise.resolve(json(200, { data: [{ data: "2026-08-02", descricao: "Excesso de velocidade", valor: 195.23, status: "em_analise" }] }));
  }
  if (url.pathname === `/api/crm/locatario/${MOCK_LOCATARIO_ID}/sinistros`) {
    return Promise.resolve(json(200, { data: [{ data: "2026-07-12", descricao: "Avaria leve", status: "aberto" }] }));
  }
  if (url.pathname === `/api/crm/locatario/${MOCK_LOCATARIO_ID}/vistoria`) {
    return Promise.resolve(json(200, { data: [{ data: "2026-09-01", descricao: "Vistoria de saída", status: "disponivel" }] }));
  }
  if (url.pathname === `/api/crm/locatario/${MOCK_LOCATARIO_ID}/documentos`) {
    return Promise.resolve(json(200, { data: [{ descricao: "Contrato assinado", status: "autorizado" }] }));
  }

  if (url.pathname === "/api/crm/disponibilidade") {
    const inicio = url.searchParams.get("inicio");
    const fim = url.searchParams.get("fim");
    if (!inicio || !fim) return Promise.resolve(json(400, { error: "periodo" }));
    return Promise.resolve(json(200, {
      data: {
        situacao: "disponivel",
        categoria: url.searchParams.get("categoria"),
        unidade: url.searchParams.get("unidade"),
        inicio,
        fim,
        preco: 210,
      },
    }));
  }

  if (url.pathname === "/api/crm/unidades") {
    return Promise.resolve(json(200, { data: [{ unidade_id: "un-1", nome: "Unidade Centro", cidade: "São Paulo" }] }));
  }

  if (url.pathname === "/api/crm/atendimento") {
    return Promise.resolve(json(200, { data: { menu: "1 financeiro 2 comercial", papeis: ["locatario"], identificar_por: ["phone"], desconhecido: "passar" } }));
  }

  return Promise.resolve(json(404, { error: "rota_ausente" }));
}
