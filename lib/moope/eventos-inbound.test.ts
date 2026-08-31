import { describe, expect, it } from "vitest";

import { processarEventoInbound } from "@/lib/moope/eventos-inbound";

function adminQueDuplica() {
  return {
    from: () => ({
      insert: async () => ({ error: { code: "23505", message: "duplicate" } }),
    }),
  };
}

function adminQueGravaPessoa() {
  const inserts: unknown[] = [];
  return {
    inserts,
    from: (tabela: string) => {
      if (tabela === "moope_inbound_events") {
        return { insert: async (row: unknown) => {
          inserts.push(row);
          return { error: null };
        } };
      }
      if (tabela === "contacts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "ct-1" }, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null }) }),
          }),
        }),
        insert: () => ({
          select: () => ({ single: async () => ({ data: { id: "x" }, error: null }) }),
        }),
      };
    },
  };
}

describe("eventos inbound MOOPE", () => {
  it("reenvio com o mesmo external_id é sucesso, sem processar de novo", async () => {
    const r = await processarEventoInbound(
      adminQueDuplica() as never,
      "org-1",
      "cx-1",
      "locadora",
      "person.upserted",
      "loc-9",
      { name: "João" },
    );
    expect(r).toEqual({ ok: true, duplicado: true });
  });

  it("person.upserted grava contato com source=moope", async () => {
    const admin = adminQueGravaPessoa();
    const r = await processarEventoInbound(
      admin as never,
      "org-1",
      "cx-1",
      "locadora",
      "person.upserted",
      "loc-9",
      { name: "João", phone: "+5511999998888" },
    );
    expect(r.ok).toBe(true);
    expect(r.contact_id).toBe("ct-1");
    expect(admin.inserts[0]).toMatchObject({
      organization_id: "org-1",
      external_id: "loc-9",
      event_type: "person.upserted",
    });
  });
});
