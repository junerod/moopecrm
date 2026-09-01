import { describe, expect, it } from "vitest";

import { idPareceUuidDoContato } from "@/lib/moope/resolver-contato";

describe("id do contato no launch da locadora", () => {
  it("reconhece o UUID do CRM e recusa o id numérico do locatário", () => {
    expect(idPareceUuidDoContato("8f4b9d4d-e9a2-49ff-8e48-b5001b3fae88")).toBe(true);
    expect(idPareceUuidDoContato("9")).toBe(false);
    expect(idPareceUuidDoContato("123")).toBe(false);
    expect(idPareceUuidDoContato("nao-e-uuid")).toBe(false);
  });
});
