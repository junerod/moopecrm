import { describe, expect, it } from "vitest";

import {
  escolherSessaoVivaParaEnvio,
  sessaoAindaPodeVoltar,
  sessaoEstaProntaParaEnvio,
  sessoesSupersedidasDoNumero,
} from "@/lib/channels/sessao-viva-para-envio";

function s(id: string, status: string, phone: string | null = "5561941144879") {
  return { id, status, phone_number: phone };
}

describe("sessão viva para envio", () => {
  it("WORKING atual segue sendo ela", () => {
    const atual = s("viva", "WORKING");
    expect(escolherSessaoVivaParaEnvio(atual, [atual, s("morta", "STOPPED")])).toEqual(atual);
  });

  it("STOPPED do mesmo número aponta para a WORKING irmã", () => {
    const morta = s("morta", "STOPPED", "+55 61 94114-4879");
    const viva = s("viva", "WORKING", "5561941144879");
    expect(escolherSessaoVivaParaEnvio(morta, [morta, viva])).toEqual(viva);
  });

  it("STOPPED de outro número não herda a WORKING", () => {
    const morta = s("morta", "STOPPED", "5561999906070");
    const viva = s("viva", "WORKING", "5561941144879");
    expect(escolherSessaoVivaParaEnvio(morta, [morta, viva])).toBeNull();
  });

  it("arquivada não serve", () => {
    const morta = s("morta", "STOPPED");
    const viva = { ...s("viva", "WORKING"), archived_at: "2026-01-01T00:00:00Z" };
    expect(escolherSessaoVivaParaEnvio(morta, [morta, viva])).toBeNull();
    expect(sessaoEstaProntaParaEnvio(viva)).toBe(false);
  });

  it("pareamento ainda pode voltar; STOPPED sem irmã não", () => {
    expect(sessaoAindaPodeVoltar("SCAN_QR_CODE")).toBe(true);
    expect(sessaoAindaPodeVoltar("STOPPED")).toBe(false);
  });

  it("lista as sessões mortas do mesmo número", () => {
    const viva = s("viva", "WORKING", "5561941144879");
    const morta = s("morta", "STOPPED", "+55 61 94114-4879");
    const outra = s("outra", "STOPPED", "5561999906070");
    expect(sessoesSupersedidasDoNumero(viva, [viva, morta, outra])).toEqual(["morta"]);
  });
});
