import { describe, expect, it } from "vitest";

import { canalExigeModeloAprovado } from "./hsm-no-composer";

describe("canalExigeModeloAprovado", () => {
  it("WAHA não exige HSM", () => {
    expect(canalExigeModeloAprovado("waha")).toBe(false);
  });

  it("Meta / Zernio / Twilio exigem", () => {
    expect(canalExigeModeloAprovado("meta_cloud")).toBe(true);
    expect(canalExigeModeloAprovado("zernio")).toBe(true);
    expect(canalExigeModeloAprovado("twilio")).toBe(true);
  });

  it("provider desconhecido: fail closed, sem picker mentiroso", () => {
    expect(canalExigeModeloAprovado("provedor-inventado")).toBe(false);
  });
});
