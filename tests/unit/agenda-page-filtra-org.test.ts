/**
 * A página da Agenda lista tipos pelo client de sessão. Platform admin
 * (`fn_is_platform_admin`) enxerga `calendar_event_types` de TODA instalação.
 * Sem `.eq("organization_id", …)` a tela oferece o tipo da org vizinha e o
 * GET de horários livres — que filtra a org ativa — devolve 404
 * "Tipo de agendamento não encontrado."
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FONTE = fs.readFileSync(
  path.join(process.cwd(), "app/app/agenda/page.tsx"),
  "utf8",
);

const TABELAS = [
  "calendar_event_types",
  "calendar_appointments",
  "calendar_connections",
] as const;

function cadeiaAposFrom(tabela: string): string {
  const marca = `.from("${tabela}")`;
  const i = FONTE.indexOf(marca);
  expect(i, `página da Agenda não consulta ${tabela}`).toBeGreaterThan(-1);
  const fim = FONTE.indexOf(";", i);
  return FONTE.slice(i, fim === -1 ? FONTE.length : fim);
}

describe("Agenda page filtra a organização ativa", () => {
  it.each(TABELAS)("%s não lista linha de outro tenant", (tabela) => {
    const cadeia = cadeiaAposFrom(tabela);
    expect(cadeia).toMatch(/\.eq\(\s*"organization_id"/);
  });
});
