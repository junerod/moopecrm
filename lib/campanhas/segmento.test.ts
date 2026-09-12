import { describe, expect, it } from "vitest";

import { destinatarioPodeReceberCampanha } from "@/lib/campanhas/consentimento";
import { contatoCasaNoSegmento, estimarSegmento } from "@/lib/campanhas/segmento";
import type { ContatoParaSegmento } from "@/lib/campanhas/tipos";

const base = (over: Partial<ContatoParaSegmento> = {}): ContatoParaSegmento => ({
  id: over.id ?? "c1",
  display_name: "Maria",
  phone_number: "+5511999990001",
  tags: ["vip"],
  papel: "lead",
  source: "whatsapp",
  is_blocked: false,
  consent: { marketing: { granted_at: null, declined_at: null } },
  ...over,
});

describe("segmento da campanha", () => {
  it("filtra por tag, papel e origem", () => {
    expect(contatoCasaNoSegmento(base(), { tags: ["vip"], papel: "lead", origem: "whatsapp" })).toBe(
      true,
    );
    expect(contatoCasaNoSegmento(base(), { tags: ["frio"] })).toBe(false);
    expect(contatoCasaNoSegmento(base(), { papel: "cliente" })).toBe(false);
  });

  it("seleção manual intersecta o restante", () => {
    expect(contatoCasaNoSegmento(base({ id: "a" }), { contact_ids: ["a", "b"], tags: ["vip"] })).toBe(
      true,
    );
    expect(contatoCasaNoSegmento(base({ id: "z" }), { contact_ids: ["a"] })).toBe(false);
  });

  it("filtra pipeline, stage, temperatura e responsável", () => {
    const c = base({
      pipeline_id: "p1",
      stage_id: "s1",
      temperatura: "quente",
      owner_user_id: "u1",
    });
    expect(
      contatoCasaNoSegmento(c, {
        pipeline_id: "p1",
        stage_id: "s1",
        temperatura: "quente",
        owner_user_id: "u1",
      }),
    ).toBe(true);
    expect(contatoCasaNoSegmento(c, { temperatura: "frio" })).toBe(false);
    expect(contatoCasaNoSegmento(c, { owner_user_id: "u2" })).toBe(false);
  });

  it("estimativa exclui bloqueado e recusa", () => {
    const lista = [
      base({ id: "ok" }),
      base({ id: "blk", is_blocked: true, phone_number: "+5511999990002" }),
      base({
        id: "no",
        phone_number: "+5511999990003",
        consent: { marketing: { declined_at: "2026-01-01T00:00:00Z" } },
      }),
    ];
    const est = estimarSegmento(lista, {});
    expect(est.selecionados).toBe(3);
    expect(est.elegiveis).toBe(1);
    expect(est.excluidos).toBe(2);
  });
});

describe("consentimento da campanha", () => {
  it("bloqueado nunca recebe", () => {
    expect(destinatarioPodeReceberCampanha(base({ is_blocked: true })).ok).toBe(false);
  });

  it("recusa de marketing nunca recebe", () => {
    const r = destinatarioPodeReceberCampanha(
      base({ consent: { marketing: { declined_at: "2026-01-01T00:00:00Z" } } }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("consent_declined");
  });

  it("grant ausente NÃO bloqueia — só declined_at", () => {
    expect(destinatarioPodeReceberCampanha(base()).ok).toBe(true);
  });

  it("sem telefone não recebe", () => {
    expect(destinatarioPodeReceberCampanha(base({ phone_number: null })).ok).toBe(false);
  });
});
