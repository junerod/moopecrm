/**
 * Retrato compacto da Gestão no cockpit — LEITURA, nunca mutação.
 * Só projeta campos que `RetratoLocatario` realmente devolve.
 */
import type { FalhaLocadora, RetratoLocatario } from "@/lib/moope/cliente-locadora";

export const NAO_CONSEGUI_CONSULTAR = "Não consegui consultar agora.";

export type ItemMoopeAuditado =
  | "cliente"
  | "veiculo"
  | "disponibilidade"
  | "locacao"
  | "contrato"
  | "parcelas"
  | "boleto_pix"
  | "checklist"
  | "vistoria"
  | "manutencao"
  | "multa"
  | "sinistro"
  | "rastreamento";

export type SituacaoDoItem = "EXISTE" | "PARCIAL" | "NAO_EXISTE";

/** Auditoria do Bloco 3 — o que o GET da locadora devolve hoje. */
export const AUDITORIA_MOOPE_GESTAO: Record<ItemMoopeAuditado, SituacaoDoItem> = {
  cliente: "EXISTE",
  veiculo: "PARCIAL",
  disponibilidade: "NAO_EXISTE",
  locacao: "PARCIAL",
  contrato: "PARCIAL",
  parcelas: "NAO_EXISTE",
  boleto_pix: "PARCIAL",
  checklist: "NAO_EXISTE",
  vistoria: "NAO_EXISTE",
  manutencao: "NAO_EXISTE",
  multa: "NAO_EXISTE",
  sinistro: "NAO_EXISTE",
  rastreamento: "NAO_EXISTE",
};

export interface RetratoComercial {
  locatario_id: string;
  nome: string;
  contrato_status: string | null;
  placa: string | null;
  veiculo_modelo: string | null;
  contrato_titulo: string | null;
  faixa: string | null;
  amount_cents: number | null;
  days_late: number | null;
  em_dia: boolean | null;
  portal_url: string | null;
  boleto_url: string | null;
  invoice_url: string | null;
}

export function locatarioIdDoContato(contato: {
  source?: string | null;
  source_metadata?: Record<string, unknown> | null;
}): string | null {
  const meta = contato.source_metadata ?? {};
  const id = meta.moope_external_id;
  if (typeof id === "string" && id.trim()) return id.trim();
  return null;
}

export function retratoDoCache(meta: Record<string, unknown> | null | undefined): RetratoLocatario | null {
  const raw = meta?.retrato_locadora;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const locatario =
    (typeof meta?.moope_external_id === "string" && meta.moope_external_id) ||
    (typeof r.locatario_id === "string" && r.locatario_id) ||
    "";
  if (!locatario && typeof r.nome !== "string") return null;
  return {
    locatario_id: locatario || "cache",
    nome: typeof r.nome === "string" ? r.nome : "",
    telefone: typeof r.telefone === "string" ? r.telefone : null,
    email: typeof r.email === "string" ? r.email : null,
    placa: typeof r.placa === "string" ? r.placa : null,
    veiculo_modelo: typeof r.veiculo_modelo === "string" ? r.veiculo_modelo : null,
    contrato_titulo: typeof r.contrato_titulo === "string" ? r.contrato_titulo : null,
    contrato_status: typeof r.contrato_status === "string" ? r.contrato_status : null,
    faixa: typeof r.faixa === "string" ? r.faixa : null,
    amount_cents: typeof r.amount_cents === "number" ? r.amount_cents : null,
    days_late: typeof r.days_late === "number" ? r.days_late : null,
    portal_url: typeof r.portal_url === "string" ? r.portal_url : null,
    boleto_url: typeof r.boleto_url === "string" ? r.boleto_url : null,
    invoice_url: typeof r.invoice_url === "string" ? r.invoice_url : null,
    documentos: [],
    pode: [],
  };
}

export function projetarRetratoComercial(retrato: RetratoLocatario): RetratoComercial {
  const atrasado = retrato.days_late != null ? retrato.days_late > 0 : null;
  return {
    locatario_id: retrato.locatario_id,
    nome: retrato.nome,
    contrato_status: retrato.contrato_status,
    placa: retrato.placa,
    veiculo_modelo: retrato.veiculo_modelo,
    contrato_titulo: retrato.contrato_titulo,
    faixa: retrato.faixa,
    amount_cents: retrato.amount_cents,
    days_late: retrato.days_late,
    em_dia: atrasado == null ? null : !atrasado,
    portal_url: retrato.portal_url,
    boleto_url: retrato.boleto_url,
    invoice_url: retrato.invoice_url,
  };
}

export function mensagemDaFalha(falha: FalhaLocadora): string {
  if (falha.codigo === "sem_integracao" || falha.codigo === "nao_encontrado") {
    return NAO_CONSEGUI_CONSULTAR;
  }
  return NAO_CONSEGUI_CONSULTAR;
}

export function fatosParaCopiloto(retrato: RetratoComercial): string {
  const partes = [`Cliente Gestão: ${retrato.nome || "sem nome"}`];
  if (retrato.contrato_status) partes.push(`contrato ${retrato.contrato_status}`);
  if (retrato.veiculo_modelo || retrato.placa) {
    partes.push(`veículo ${[retrato.veiculo_modelo, retrato.placa].filter(Boolean).join(" ")}`);
  }
  if (retrato.em_dia === true) partes.push("cobrança em dia");
  if (retrato.em_dia === false) partes.push(`atraso ${retrato.days_late} dia(s)`);
  return partes.join("; ");
}
