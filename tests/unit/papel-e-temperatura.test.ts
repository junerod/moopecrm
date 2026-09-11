import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { contatoNaoSalvo } from "@/lib/contacts/rotulo-do-contato";
import {
  seloDaPessoa,
  temperaturaDoLeadAberto,
} from "@/lib/crm/papel-e-temperatura";
import { contactPatchSchema } from "@/lib/schemas/contacts";
import { listConversationsQuerySchema } from "@/lib/schemas/messaging";
import { updateLeadSchema } from "@/lib/schemas/leads";
import { motivoSemNascimentoDoContato } from "@/lib/leads/nascimento-do-lead";

describe("seloDaPessoa", () => {
  it("Equipe vence não-salvo e temperatura", () => {
    expect(
      seloDaPessoa({ papel: "equipe", naoSalvo: true, temperatura: "quente" }),
    ).toEqual({ kind: "equipe", texto: "Equipe" });
  });

  it("Ignorar também vence não-salvo", () => {
    expect(
      seloDaPessoa({ papel: "ignorado", naoSalvo: true, temperatura: "quente" }),
    ).toEqual({ kind: "ignorado", texto: "Ignorar" });
  });

  it("não salvo só com name vazio", () => {
    expect(
      seloDaPessoa({
        papel: null,
        naoSalvo: contatoNaoSalvo({ display_name: "Paulo", name: null }),
        temperatura: null,
      }),
    ).toEqual({ kind: "nao_salvo", texto: "Nome do WhatsApp · não salvo" });
    expect(
      contatoNaoSalvo({ display_name: "Paulo", name: "TEC Paulo" }),
    ).toBe(false);
  });

  it("Lead quente quando há temperatura", () => {
    expect(seloDaPessoa({ papel: "lead", naoSalvo: false, temperatura: "quente" })).toEqual({
      kind: "lead",
      texto: "Lead quente",
    });
  });
});

describe("temperaturaDoLeadAberto", () => {
  it("lê só o negócio aberto", () => {
    expect(
      temperaturaDoLeadAberto([
        { status: "won", temperatura: "quente" },
        { status: "open", temperatura: "frio" },
      ]),
    ).toBe("frio");
  });
});

describe("Equipe não chama nascimento", () => {
  it("recusa equipe antes de olhar funil", () => {
    expect(motivoSemNascimentoDoContato({ papel: "equipe", is_blocked: false })).toBe(
      "contato_equipe",
    );
    expect(motivoSemNascimentoDoContato({ papel: "ignorado", is_blocked: false })).toBe(
      "contato_ignorado",
    );
    expect(motivoSemNascimentoDoContato({ papel: "lead", is_blocked: false })).toBeNull();
    expect(motivoSemNascimentoDoContato({ papel: "cliente", is_blocked: false })).toBe(
      "contato_cliente",
    );
    expect(motivoSemNascimentoDoContato({ papel: null, is_blocked: true })).toBe(
      "contato_bloqueado",
    );
  });
});

describe("schemas de papel e temperatura", () => {
  it("PATCH /contacts aceita papel e recusa lixo", () => {
    expect(contactPatchSchema.safeParse({ papel: "equipe" }).success).toBe(true);
    expect(contactPatchSchema.safeParse({ papel: "ignorado" }).success).toBe(true);
    expect(contactPatchSchema.safeParse({ papel: "vizinho" }).success).toBe(false);
  });

  it("PATCH /leads aceita temperatura humana", () => {
    expect(updateLeadSchema.safeParse({ temperatura: "quente" }).success).toBe(true);
    expect(updateLeadSchema.safeParse({ temperatura: "fervendo" }).success).toBe(false);
  });

  it("GET /conversations aceita filtro de papel", () => {
    expect(listConversationsQuerySchema.safeParse({ papel: "comercial" }).success).toBe(true);
    expect(listConversationsQuerySchema.safeParse({ papel: "todos" }).success).toBe(true);
    expect(listConversationsQuerySchema.safeParse({ papel: "ignorado" }).success).toBe(true);
    expect(listConversationsQuerySchema.safeParse({ papel: "secretaria" }).success).toBe(false);
  });
});

describe("o envio não morre no claim", () => {
  it("createAdminClient não é default-arg da invalidação", () => {
    const fonte = readFileSync("lib/ai/execucao/invalidar-jobs.ts", "utf8");
    expect(fonte).not.toMatch(/admin:\s*SupabaseClient\s*=\s*createAdminClient\(\)/);
  });

  it("o POST /messages envolve assumirPeloEnvioHumano em try", () => {
    const fonte = readFileSync("app/api/v1/messages/_handler.ts", "utf8");
    expect(fonte).toMatch(/try\s*\{\s*await assumirPeloEnvioHumano/s);
  });

  it("filtro comercial não usa neq equipe — NULL sumiria", () => {
    const fonte = readFileSync("app/api/v1/conversations/_handler.ts", "utf8");
    expect(fonte).toMatch(/contacts\.papel\.is\.null/);
    expect(fonte).not.toMatch(/neq\(["']contacts\.papel["']/);
  });
});
