import { afterEach, describe, expect, it, vi } from "vitest";

import {
  _resetarSementeDeCifraParaTeste,
  encryptWebhookSecret,
  garantirChaveDeCifra,
} from "@/lib/webhooks/secrets";

afterEach(() => {
  _resetarSementeDeCifraParaTeste();
  delete process.env.NUVEMSHOP_OAUTH_ENCRYPTION_KEY;
});

describe("garantirChaveDeCifra", () => {
  it("semeia a chave do env uma vez, antes de cifrar", async () => {
    process.env.NUVEMSHOP_OAUTH_ENCRYPTION_KEY = "a".repeat(32);
    const rpc = vi.fn(async (fn: string) => {
      if (fn === "fn_seed_oauth_key") return { data: true, error: null };
      return { data: "\\xabc", error: null };
    });
    const admin = { rpc } as never;

    await encryptWebhookSecret(admin, "segredo");
    await encryptWebhookSecret(admin, "outro");

    const sementes = rpc.mock.calls.filter((c) => c[0] === "fn_seed_oauth_key");
    expect(sementes).toHaveLength(1);
    expect(sementes[0]?.[1]).toEqual({ p_value: "a".repeat(32) });
    expect(rpc.mock.calls.filter((c) => c[0] === "fn_encrypt_oauth")).toHaveLength(2);
  });

  it("não chama a RPC quando o env está vazio — senão inventa chave", async () => {
    delete process.env.NUVEMSHOP_OAUTH_ENCRYPTION_KEY;
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    await garantirChaveDeCifra({ rpc } as never);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("não chama a RPC quando a chave tem menos de 32 caracteres", async () => {
    process.env.NUVEMSHOP_OAUTH_ENCRYPTION_KEY = "curta";
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    await garantirChaveDeCifra({ rpc } as never);
    expect(rpc).not.toHaveBeenCalled();
  });
});
