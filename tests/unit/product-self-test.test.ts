import { describe, expect, it } from "vitest";

import { canalExternoAutorizado, rodarSelfTestContrato } from "@/lib/self-test/rodar";
import { totalizar } from "@/lib/self-test/relatorio";

describe("product self-test", () => {
  it("canal externo fica desligado no padrão", () => {
    expect(canalExternoAutorizado({ SELF_TEST_EXTERNAL_CHANNELS: undefined })).toBe(false);
    expect(canalExternoAutorizado({ SELF_TEST_EXTERNAL_CHANNELS: "true" })).toBe(true);
  });

  it("contrato dos dois packs e do mock não inventa PASS de canal externo", async () => {
    const modulos = await rodarSelfTestContrato();
    expect(modulos.find((m) => m.modulo === "whatsapp_externo")?.status).toBe("SKIPPED");
    expect(modulos.find((m) => m.modulo === "vision")?.status).toBe("SKIPPED");
    expect(modulos.find((m) => m.modulo === "pack")?.status).toBe("PASS");
    expect(modulos.find((m) => m.modulo === "assistentes")?.status).toBe("PASS");
    expect(modulos.find((m) => m.modulo === "gestao_bridge")?.status).toBe("PASS");
    expect(totalizar(modulos)).toBe("PARTIAL");
  });
});
