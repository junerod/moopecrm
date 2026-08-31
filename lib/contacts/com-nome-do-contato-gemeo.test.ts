import { describe, expect, it, vi } from "vitest";

import { comNomeDoContatoGemeo } from "@/lib/contacts/com-nome-do-contato-gemeo";
import { contatoDoEmbed, rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";

const ORG = "org-1";
const STUB = "contato-lid";
const CADASTRO = "contato-moope";

function clienteCom(linhas: Array<{
  id: string;
  phone_number: string | null;
  display_name: string | null;
  name: string | null;
}>) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            is: async () => ({ data: linhas, error: null }),
          }),
        }),
      }),
    }),
  };
}

describe("comNomeDoContatoGemeo", () => {
  it("traz o nome do cadastro que já tem o telefone em conflito", async () => {
    const cliente = clienteCom([
      { id: CADASTRO, phone_number: "+5531988887777", display_name: "João Locatário", name: "João" },
    ]);

    const [saida] = await comNomeDoContatoGemeo(cliente as never, ORG, [
      {
        contacts: {
          id: STUB,
          display_name: null,
          name: null,
          phone_number: null,
          source_metadata: { telefone_em_conflito: "+5531988887777" },
        },
      },
    ]);

    expect(rotuloDoContato(saida?.contacts), "o Inbox tem de mostrar quem Contatos já mostra").toBe(
      "João Locatário",
    );
  });

  it("não inventa nome quando o gêmeo é o próprio stub", async () => {
    const cliente = clienteCom([
      { id: STUB, phone_number: "+5531988887777", display_name: null, name: null },
    ]);

    const [saida] = await comNomeDoContatoGemeo(cliente as never, ORG, [
      {
        contacts: {
          id: STUB,
          display_name: null,
          name: null,
          phone_number: "+5531988887777",
        },
      },
    ]);

    expect(rotuloDoContato(saida?.contacts)).toBe("+5531988887777");
  });

  it("não consulta quando o stub já tem nome", async () => {
    const from = vi.fn();
    const cliente = { from };

    const [saida] = await comNomeDoContatoGemeo(cliente as never, ORG, [
      { contacts: { id: STUB, display_name: "Ana", name: null, phone_number: null } },
    ]);

    expect(from).not.toHaveBeenCalled();
    expect(rotuloDoContato(saida?.contacts)).toBe("Ana");
  });

  it("desembrulha o embed em array — senão todo mundo vira Sem nome", async () => {
    const cliente = clienteCom([]);

    const [saida] = await comNomeDoContatoGemeo(cliente as never, ORG, [
      {
        contacts: [{ id: STUB, display_name: "Carlos", name: null, phone_number: "+5531911112222" }],
      },
    ]);

    expect(Array.isArray(saida?.contacts), "o embed tem de sair como objeto, não array").toBe(
      false,
    );
    expect(rotuloDoContato(contatoDoEmbed(saida?.contacts))).toBe("Carlos");
  });
});
