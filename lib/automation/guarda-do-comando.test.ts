/**
 * ETAPA 1 — automação de ENVIO respeita o mesmo predicado de comando.
 *
 * TESTE E: humano no comando → SKIP/DENY.
 * TESTE F: add_tag não consulta o predicado — efeito interno segue.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { decidirEnvioConversacional } from "@/lib/inbox/comando-da-conversa";
import { decidirAPartirDosFatos } from "@/lib/inbox/ler-comando";
import { desfechoPuladoPorComando } from "@/lib/automation/guarda-do-comando";

const ATENDENTE = "11111111-1111-4111-8111-111111111111";
const AGORA = new Date("2026-09-07T12:00:00.000Z");

describe("guarda-do-comando — envio conversacional", () => {
  it("TESTE E: humano no comando → SKIP com DENY_HUMAN_ACTIVE", () => {
    const decisao = decidirEnvioConversacional(
      {
        status: "claimed",
        assigned_to_user_id: ATENDENTE,
        assignee_kind: "user",
        bot_silenced_until: "infinity",
      },
      AGORA,
    );
    expect(decisao.permitido).toBe(false);
    if (decisao.permitido) throw new Error("inalcançável");
    const skip = desfechoPuladoPorComando("send_whatsapp_message", decisao);
    expect(skip.status).toBe("skipped");
    expect(skip.detail.reason).toBe("DENY_HUMAN_ACTIVE");
  });

  it("sem fatos (lookup vazio) = fail-open — não inventa trava", () => {
    expect(decidirAPartirDosFatos(null)).toEqual({ permitido: true });
  });
});

describe("TESTE F — ação interna não passa pela trava de envio", () => {
  const raiz = join(__dirname, "..", "..");

  it("add_tag não importa a guarda de comando", () => {
    const fonte = readFileSync(join(raiz, "lib/automation/actions/add-tag.ts"), "utf8");
    expect(fonte).not.toContain("guarda-do-comando");
    expect(fonte).not.toContain("decidirEnvioConversacional");
  });

  it("as duas ações de ENVIO consultam a mesma guarda", () => {
    for (const arquivo of ["send-whatsapp.ts", "send-ai-message.ts"]) {
      const fonte = readFileSync(join(raiz, "lib/automation/actions", arquivo), "utf8");
      expect(fonte, arquivo).toContain("checarComandoParaEnvio");
    }
  });
});
