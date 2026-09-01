import { describe, expect, it } from "vitest";

import { processarEventoInbound } from "@/lib/moope/eventos-inbound";

function adminQueDuplica() {
  return {
    from: () => ({
      insert: async () => ({ error: { code: "23505", message: "duplicate" } }),
    }),
  };
}

function contactsFluent(opts: { insertId?: string; rows?: unknown[] }) {
  const self: Record<string, unknown> = {};
  Object.assign(self, {
    select: () => self,
    eq: () => self,
    in: () => self,
    is: () => self,
    neq: () => self,
    maybeSingle: async () => ({ data: null, error: null }),
    insert: () => ({
      select: () => ({
        single: async () => ({ data: { id: opts.insertId ?? "ct-1" }, error: null }),
      }),
    }),
    update: () => self,
    then: (resolve: (v: { data: unknown }) => void) => resolve({ data: opts.rows ?? [] }),
  });
  return self;
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
      if (tabela === "contacts") return contactsFluent({ insertId: "ct-1" });
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

function adminQueReprocessaPessoa() {
  const updates: string[] = [];
  return {
    updates,
    from: (tabela: string) => {
      if (tabela === "moope_inbound_events") {
        return { insert: async () => ({ error: { code: "23505", message: "duplicate" } }) };
      }
      if (tabela === "contacts") {
        const self = contactsFluent({
          rows: [
            {
              id: "ct-wa",
              display_name: "June",
              name: null,
              phone_number: "+556196715985",
              email: null,
              source: "whatsapp",
              source_metadata: {},
              wa_identity: "phone:+556196715985",
              wa_lid: "1",
              is_merged_into: null,
            },
          ],
        });
        self.update = () => {
          updates.push("ok");
          return self;
        };
        return self;
      }
      return contactsFluent({});
    },
  };
}

describe("eventos inbound MOOPE", () => {
  it("reenvio de contract.changed é sucesso, sem processar de novo", async () => {
    const r = await processarEventoInbound(
      adminQueDuplica() as never,
      "org-1",
      "cx-1",
      "locadora",
      "contract.changed",
      "ctr-1",
      { title: "Onix" },
    );
    expect(r).toEqual({ ok: true, duplicado: true });
  });

  it("reenvio de person.upserted ainda atualiza o contato", async () => {
    const admin = adminQueReprocessaPessoa();
    const r = await processarEventoInbound(
      admin as never,
      "org-1",
      "cx-1",
      "locadora",
      "person.upserted",
      "1",
      { name: "Juneval", phone: "+5561996715985" },
    );
    expect(r.ok).toBe(true);
    expect(r.duplicado).toBe(true);
    expect(r.contact_id).toBe("ct-wa");
    expect(admin.updates.length).toBeGreaterThan(0);
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
