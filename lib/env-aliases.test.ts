import { describe, expect, it } from "vitest";

import { aliasesDeEnv, aplicarAliasesDeEnv } from "@/lib/env-aliases";

describe("aliasesDeEnv", () => {
  it("MAILSERVER_FROM vira MAILSERVER_FROM_EMAIL", () => {
    const out = aliasesDeEnv({
      MAILSERVER_FROM: "info@info.exemplo.com.br",
    });
    expect(out.MAILSERVER_FROM_EMAIL).toBe("info@info.exemplo.com.br");
  });

  it("canônico preenchido ganha do alias", () => {
    const out = aliasesDeEnv({
      MAILSERVER_FROM_EMAIL: "a@crm.exemplo",
      MAILSERVER_FROM: "b@finance.exemplo",
    });
    expect(out.MAILSERVER_FROM_EMAIL).toBe("a@crm.exemplo");
  });

  it("STORAGE_DRIVER=r2 e R2_BUCKET viram o contrato do Knowledge", () => {
    const out = aliasesDeEnv({
      STORAGE_DRIVER: "r2",
      R2_BUCKET: "moopeknowledge",
      R2_ENDPOINT: "https://abc123def456.r2.cloudflarestorage.com",
    });
    expect(out.KNOWLEDGE_STORAGE_PROVIDER).toBe("r2");
    expect(out.R2_BUCKET_KNOWLEDGE).toBe("moopeknowledge");
    expect(out.R2_ACCOUNT_ID).toBe("abc123def456");
  });

  it("vazio é ausente — não inventa valor", () => {
    const out = aliasesDeEnv({
      MAILSERVER_FROM: "",
      STORAGE_DRIVER: "   ",
    });
    expect(out.MAILSERVER_FROM_EMAIL).toBeUndefined();
    expect(out.KNOWLEDGE_STORAGE_PROVIDER).toBeUndefined();
  });

  it("MOOPE_MAIL_URL / MOOPE_API_KEY preenchem o mailserver", () => {
    const out = aliasesDeEnv({
      MOOPE_MAIL_URL: "https://mailserver.exemplo.com.br",
      MOOPE_API_KEY: "chave",
    });
    expect(out.MAILSERVER_URL).toBe("https://mailserver.exemplo.com.br");
    expect(out.MAILSERVER_API_KEY).toBe("chave");
  });
});

describe("aplicarAliasesDeEnv", () => {
  it("só escreve chave canônica que ainda está vazia", () => {
    const env: Record<string, string | undefined> = {
      MAILSERVER_FROM: "info@info.exemplo.com.br",
      MAILSERVER_FROM_EMAIL: "",
      KNOWLEDGE_STORAGE_PROVIDER: "supabase",
      STORAGE_DRIVER: "r2",
    };
    aplicarAliasesDeEnv(env);
    expect(env.MAILSERVER_FROM_EMAIL).toBe("info@info.exemplo.com.br");
    expect(env.KNOWLEDGE_STORAGE_PROVIDER).toBe("supabase");
  });
});
