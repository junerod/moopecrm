import { describe, expect, it } from "vitest";

import { validarMidiaDaCampanha, caminhoDeMidiaCampanha } from "@/lib/campanhas/midia";

describe("mídia da campanha", () => {
  it("aceita jpeg/png/webp/mp4/pdf", () => {
    expect(validarMidiaDaCampanha("image/jpeg", 1000).ok).toBe(true);
    expect(validarMidiaDaCampanha("image/png", 1000).ok).toBe(true);
    expect(validarMidiaDaCampanha("image/webp", 1000).ok).toBe(true);
    expect(validarMidiaDaCampanha("video/mp4", 1000).ok).toBe(true);
    expect(validarMidiaDaCampanha("application/pdf", 1000).ok).toBe(true);
  });

  it("recusa tipo e tamanho", () => {
    expect(validarMidiaDaCampanha("image/gif", 1000).ok).toBe(false);
    expect(validarMidiaDaCampanha("image/jpeg", 6 * 1024 * 1024).ok).toBe(false);
  });

  it("path não é base64 e fica sob a org", () => {
    const p = caminhoDeMidiaCampanha("org-1", "camp-1", "foto.png");
    expect(p.startsWith("org-1/campaigns/camp-1/")).toBe(true);
    expect(p.includes("base64")).toBe(false);
  });
});
