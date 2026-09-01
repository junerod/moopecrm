import { describe, expect, it } from "vitest";

import {
  escolherDestinoDaPessoa,
  patchDaPessoa,
  upsertPessoa,
  variantesDeTelefone,
} from "@/lib/moope/pessoa";

const locadora = {
  id: "ct-mop",
  display_name: "Juneval Rodrigues",
  name: "Juneval Rodrigues",
  phone_number: "+5561996715985",
  email: null,
  source: "moope",
  source_metadata: { moope_external_id: "1" },
  wa_identity: "phone:+5561996715985",
  wa_lid: null,
  is_merged_into: null,
};

const whatsapp = {
  id: "ct-wa",
  display_name: "June Rodrigues",
  name: null,
  phone_number: "+556196715985",
  email: null,
  source: "whatsapp",
  source_metadata: {},
  wa_identity: "phone:+556196715985",
  wa_lid: "235587596492898",
  is_merged_into: null,
};

describe("variantesDeTelefone", () => {
  it("o 9 a mais e o 9 a menos são o mesmo celular", () => {
    const v = variantesDeTelefone("+5561996715985");
    expect(v).toContain("+5561996715985");
    expect(v).toContain("+556196715985");
  });
});

describe("escolherDestinoDaPessoa", () => {
  it("ficha da locadora cede ao gêmeo com LID", () => {
    expect(escolherDestinoDaPessoa([locadora, whatsapp])?.id).toBe("ct-wa");
  });

  it("sem WhatsApp fica na ficha da locadora", () => {
    expect(escolherDestinoDaPessoa([locadora])?.id).toBe("ct-mop");
  });
});

describe("patchDaPessoa", () => {
  it("não apaga o nome do WhatsApp nem o telefone do fio", () => {
    const p = patchDaPessoa(whatsapp, {
      external_id: "1",
      name: "Juneval Rodrigues",
      phone: "+5561996715985",
    });
    expect(p.display_name).toBeUndefined();
    expect(p.phone_number).toBeUndefined();
    expect(p.source).toBeUndefined();
    expect((p.source_metadata as { moope_external_id: string }).moope_external_id).toBe("1");
    expect((p.source_metadata as { moope_name: string }).moope_name).toBe("Juneval Rodrigues");
  });

  it("preenche nome só quando a ficha não tem nome de gente", () => {
    const p = patchDaPessoa(
      { ...whatsapp, display_name: null, name: null, source_metadata: {} },
      { external_id: "1", name: "Juneval Rodrigues" },
    );
    expect(p.display_name).toBe("Juneval Rodrigues");
  });
});

describe("upsertPessoa", () => {
  it("não copia e-mail se outra ficha do par já tem", () => {
    const p = patchDaPessoa(whatsapp, {
      external_id: "1",
      name: "Juneval Rodrigues",
      email: "junerod@hotmail.com",
    });
    expect(p.email).toBe("junerod@hotmail.com");
  });

  it("transfere o id da locadora para o gêmeo com LID", async () => {
    const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const admin = {
      from: (tabela: string) => {
        if (tabela !== "contacts") throw new Error(tabela);
        const self = {
          select: () => self,
          eq: () => self,
          in: () => self,
          is: () => self,
          neq: () => self,
          update: (patch: Record<string, unknown>) => {
            const chain = {
              eq: (_col: string, val: string) => {
                if (_col === "id") updates.push({ id: val, patch });
                return chain;
              },
            };
            return chain;
          },
          then: (resolve: (v: { data: unknown }) => void) => {
            if (updates.length === 0) {
              resolve({ data: [locadora, whatsapp] });
              return;
            }
            resolve({ data: [locadora] });
          },
        };
        return self;
      },
    };
    const id = await upsertPessoa(admin as never, "org", {
      external_id: "1",
      name: "Juneval Rodrigues",
      phone: "+5561996715985",
    });
    expect(id).toBe("ct-wa");
    expect(updates[0]?.id).toBe("ct-wa");
  });
});
