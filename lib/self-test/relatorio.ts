import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import type { RelatorioSelfTest, StatusModulo } from "@/lib/self-test/tipos";

const ROTULO: Record<string, string> = {
  onboarding: "Onboarding",
  pack: "Pack",
  assistentes: "Assistentes",
  knowledge: "Knowledge",
  vision: "Vision",
  crm: "CRM",
  agenda: "Agenda",
  campanhas: "Campanhas",
  automacoes: "Automações",
  tenant_isolation: "Tenant isolation",
  whatsapp_externo: "WhatsApp externo",
  gestao_bridge: "Gestão Bridge",
};

function linha(nome: string, status: StatusModulo): string {
  return `${nome.padEnd(20, ".")} ${status}`;
}

export function markdownDoRelatorio(r: RelatorioSelfTest): string {
  const linhas = r.modulos.map((m) => linha(ROTULO[m.modulo] ?? m.modulo, m.status));
  const evidencias = r.modulos
    .flatMap((m) => (m.evidencias ?? []).map((e) => `- ${m.modulo}: ${e}`))
    .join("\n");
  return [
    "# MOOPE CRM SELF TEST",
    "",
    `Gerado em: ${r.gerado_em}`,
    `Duração: ${Math.round(r.duracao_ms / 1000)}s`,
    `Organizações: ${r.organizacoes.join(", ") || "(nenhuma ao vivo)"}`,
    `Disparo externo: NÃO`,
    `SELF_TEST_EXTERNAL_CHANNELS: ${r.self_test_external_channels}`,
    `Vision: ${r.visao}`,
    `Gestão: ${r.gestao === "CONTRACT_E2E" ? "CONTRACT E2E VALIDADO" : r.gestao === "PRODUCAO_REAL" ? "GESTÃO PRODUÇÃO REAL VALIDADA" : "SKIPPED"}`,
    "",
    ...linhas,
    "",
    `TOTAL: ${r.total}`,
    "",
    "## Evidências",
    evidencias || "- (sem evidências extras)",
    "",
    "## Detalhe por módulo",
    ...r.modulos.map((m) => `- **${ROTULO[m.modulo] ?? m.modulo}** (${m.status}): ${m.detalhe}`),
    "",
  ].join("\n");
}

export function gravarRelatorio(r: RelatorioSelfTest, raiz = process.cwd()): void {
  const dir = path.join(raiz, "docs", "self-test");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "latest.json"), `${JSON.stringify(r, null, 2)}\n`, "utf8");
  writeFileSync(path.join(dir, "latest.md"), markdownDoRelatorio(r), "utf8");
}

export function totalizar(modulos: RelatorioSelfTest["modulos"]): RelatorioSelfTest["total"] {
  if (modulos.some((m) => m.status === "FAIL")) return "FAIL";
  if (modulos.some((m) => m.status === "PARTIAL" || m.status === "SKIPPED")) return "PARTIAL";
  return "PASS";
}
