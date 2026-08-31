import { describe, expect, it, vi } from "vitest";

import { assinarSaida, entregarEventoAoParceiro } from "@/lib/moope/eventos-outbound";
import type { EventRow } from "@/lib/event-log/dispatcher";

vi.mock("@/lib/webhooks/secrets", () => ({
  decryptWebhookSecret: vi.fn(async () => "segredo-saida"),
}));

function adminFake(conexao: Record<string, unknown> | null) {
  return {
    from: (tabela: string) => {
      if (tabela === "moope_connections") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: conexao, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      };
    },
  };
}

const row: EventRow = {
  id: "e1",
  organization_id: "org-1",
  event_type: "conversation.opened",
  entity_kind: "conversation",
  entity_id: "c1",
  payload: { moope_external_id: "loc-9" },
  metadata: {},
  consumed_by: [],
  attempts: 0,
};

describe("saída MOOPE", () => {
  it("HMAC é do body inteiro", () => {
    const sig = assinarSaida("s3", '{"a":1}');
    expect(sig.startsWith("sha256=")).toBe(true);
    expect(sig.length).toBeGreaterThan(10);
  });

  it("sem webhook do parceiro, pula — não é erro", async () => {
    const r = await entregarEventoAoParceiro(adminFake(null) as never, row);
    expect(r.status).toBe("skipped");
  });

  it("POST assinado; falha HTTP vira retry", async () => {
    const fetchFn = vi.fn(async () => new Response("no", { status: 502 }));
    const r = await entregarEventoAoParceiro(
      adminFake({
        id: "cx",
        organization_id: "org-1",
        kind: "locadora",
        partner_webhook_url: "https://frota.exemplo/hooks/crm",
        inbound_key_prefix: "mop_aa",
        inbound_key_hash: "hh",
        outbound_secret_enc: "\\x00",
        status: "active",
      }) as never,
      row,
      { fetchFn },
    );
    expect(r.status).toBe("retry");
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledWith(
      "https://frota.exemplo/hooks/crm",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Moope-Signature": expect.stringMatching(/^sha256=/),
        }),
      }),
    );
  });
});
