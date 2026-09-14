export const MODULOS_SELF_TEST = [
  "onboarding",
  "pack",
  "assistentes",
  "knowledge",
  "vision",
  "crm",
  "agenda",
  "campanhas",
  "automacoes",
  "tenant_isolation",
  "whatsapp_externo",
  "gestao_bridge",
] as const;

export type ModuloSelfTest = (typeof MODULOS_SELF_TEST)[number];

export type StatusModulo = "PASS" | "FAIL" | "PARTIAL" | "SKIPPED";

export interface ResultadoModulo {
  modulo: ModuloSelfTest;
  status: StatusModulo;
  detalhe: string;
  evidencias?: string[];
}

export interface RelatorioSelfTest {
  gerado_em: string;
  duracao_ms: number;
  organizacoes: string[];
  disparo_externo: false;
  self_test_external_channels: boolean;
  visao: "REAL" | "MOCK" | "SKIPPED";
  gestao: "CONTRACT_E2E" | "PRODUCAO_REAL" | "SKIPPED";
  modulos: ResultadoModulo[];
  total: "PASS" | "PARTIAL" | "FAIL";
}
