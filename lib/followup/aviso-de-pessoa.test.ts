import { describe, expect, it } from "vitest";

import { corpoDoAviso, gravarAvisoDePessoa } from "./aviso-de-pessoa";

const CONTATO = {
  organization_id: "org",
  contact_id: "ct",
  conversation_id: "cv",
};

describe("aviso de pessoa", () => {
  it("o comentário entra no aviso e o cliente não é citado como destinatário", () => {
    const aviso = corpoDoAviso({
      note: "Quer marcar horário na terça.",
      encaminhou: true,
      assignFalhou: false,
    });
    expect(aviso.title).toBe("O bot pediu uma pessoa");
    expect(aviso.body).toContain("Quer marcar horário na terça.");
    expect(aviso.body).toContain("pessoa escolhida");
  });

  it("se a pessoa escolhida não aceita, a Central ainda abre", async () => {
    const abertos: string[] = [];
    let marcou = false;
    await gravarAvisoDePessoa(
      {
        marcarHumano: async () => {
          marcou = true;
        },
        atribuir: async () => {
          throw new Error("assignee_not_eligible_member");
        },
        abrirCentral: async (item) => {
          abertos.push(item.body);
        },
      },
      CONTATO,
      { userId: "11111111-1111-4111-8111-111111111111", note: "Cliente pediu o advogado." },
    );
    expect(marcou).toBe(true);
    expect(abertos).toHaveLength(1);
    expect(abertos[0]).toContain("Cliente pediu o advogado.");
    expect(abertos[0]).toContain("ficou na Central");
  });
});
