import { describe, expect, it } from "vitest";

import { rotearContato } from "@/lib/campanhas/canais";
import { destinatarioPodeReceberNoCanal } from "@/lib/campanhas/consentimento";
import { estimarSegmento } from "@/lib/campanhas/segmento";
import { segmentoVazio } from "@/lib/campanhas/tipos";
import type { ContatoParaSegmento } from "@/lib/campanhas/tipos";

const base = (over: Partial<ContatoParaSegmento> = {}): ContatoParaSegmento => ({
  id: over.id ?? "c1",
  display_name: "Maria",
  phone_number: "+5511999990001",
  email: "maria@exemplo.com",
  tags: ["vip"],
  is_blocked: false,
  consent: { marketing: { granted_at: null, declined_at: null } },
  ...over,
});

describe("roteamento multi-canal", () => {
  it("ambos: telefone+email recebe nos dois", () => {
    const r = rotearContato(base(), "ambos");
    expect(r.destinos).toHaveLength(2);
    expect(r.ignorado).toBe(false);
  });

  it("só telefone cai no WhatsApp", () => {
    const r = rotearContato(base({ email: null }), "ambos");
    expect(r.destinos).toEqual([{ canal: "whatsapp", destination: "+5511999990001" }]);
  });

  it("só email cai no e-mail", () => {
    const r = rotearContato(base({ phone_number: null }), "ambos");
    expect(r.destinos).toEqual([{ canal: "email", destination: "maria@exemplo.com" }]);
  });

  it("nenhum canal é ignorado", () => {
    const r = rotearContato(base({ phone_number: null, email: null }), "ambos");
    expect(r.ignorado).toBe(true);
    expect(r.motivo).toBeTruthy();
  });

  it("email only sem email falha", () => {
    expect(destinatarioPodeReceberNoCanal(base({ email: null }), "email").ok).toBe(false);
  });

  it("bloqueado não recebe em canal nenhum", () => {
    expect(destinatarioPodeReceberNoCanal(base({ is_blocked: true }), "email").ok).toBe(false);
    expect(destinatarioPodeReceberNoCanal(base({ is_blocked: true }), "whatsapp").ok).toBe(false);
  });
});

describe("estimativa com exclusões", () => {
  it("separa bloqueados, opt-out e sem canal", () => {
    const est = estimarSegmento(
      [
        base({ id: "ok" }),
        base({ id: "blk", is_blocked: true, phone_number: "+5511999990002" }),
        base({
          id: "no",
          phone_number: "+5511999990003",
          consent: { marketing: { declined_at: "2026-01-01T00:00:00Z" } },
        }),
        base({ id: "sem", phone_number: null, email: null }),
      ],
      {},
      "whatsapp",
      4,
    );
    expect(est.elegiveis).toBe(1);
    expect(est.exclusoes.bloqueados).toBe(1);
    expect(est.exclusoes.opt_out).toBe(1);
    expect(est.atinge_base_inteira).toBe(true);
  });

  it("segmento vazio é a base inteira", () => {
    expect(segmentoVazio({})).toBe(true);
    expect(segmentoVazio({ tags: ["vip"] })).toBe(false);
  });
});
