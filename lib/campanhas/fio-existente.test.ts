import { describe, expect, it } from "vitest";

import { decidirFioDaCampanha } from "@/lib/campanhas/fio-existente";

function sess(id: string, status: string, phone: string) {
  return { id, status, phone_number: phone };
}

describe("fio existente da campanha", () => {
  const viva = sess("viva", "WORKING", "5561941144879");
  const morta = sess("morta", "STOPPED", "+55 61 94114-4879");
  const outra = sess("outra", "STOPPED", "5561999906070");

  it("June no número reconectado: usa o fio antigo e manda pela WORKING", () => {
    const r = decidirFioDaCampanha({
      sessaoPedida: null,
      sessoes: [viva, morta, outra],
      conversas: [{ id: "cv-june", channel_session_id: "morta" }],
    });
    expect(r).toEqual({ conversationId: "cv-june", sessionId: "viva" });
  });

  it("sem conversa neste número: não inventa fio", () => {
    const r = decidirFioDaCampanha({
      sessaoPedida: "viva",
      sessoes: [viva, morta, outra],
      conversas: [{ id: "cv-outra", channel_session_id: "outra" }],
    });
    expect(r).toBeNull();
  });

  it("já está na WORKING: segue nela", () => {
    const r = decidirFioDaCampanha({
      sessaoPedida: "viva",
      sessoes: [viva],
      conversas: [{ id: "cv", channel_session_id: "viva" }],
    });
    expect(r).toEqual({ conversationId: "cv", sessionId: "viva" });
  });
});
