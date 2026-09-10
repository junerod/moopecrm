import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from "@/lib/api/client";
import { garantirContatoDoLead } from "./garantir-contato-do-lead";

describe("garantirContatoDoLead", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it("reusa o contato do mesmo telefone", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [{ id: "c-ja-existe", phone_number: "+5548999999999" }],
    } as never);
    const id = await garantirContatoDoLead({
      nome: "João Silva",
      telefone: "(48) 99999-9999",
    });
    expect(id).toBe("c-ja-existe");
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("cria quando o telefone é novo", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] } as never);
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { contact: { id: "c-novo" } },
    } as never);
    const id = await garantirContatoDoLead({
      nome: "João Silva",
      telefone: "(48) 98888-0000",
    });
    expect(id).toBe("c-novo");
    expect(apiClient.post).toHaveBeenCalled();
  });

  it("não cria pessoa vazia", async () => {
    const id = await garantirContatoDoLead({ nome: "  ", telefone: "" });
    expect(id).toBeNull();
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
