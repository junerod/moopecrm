import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** PNG comercial de teste — não depende de arquivo privado. */
export function pngCampanhaLocadoras(): Buffer {
  const canvas = createCanvas(900, 640);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0B1F3A";
  ctx.fillRect(0, 0, 900, 640);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText("MOOPE", 40, 70);
  ctx.font = "24px sans-serif";
  ctx.fillText("Sua locadora cresceu. Sua gestão acompanhou?", 40, 120);
  ctx.font = "18px sans-serif";
  const mods = [
    "Locações",
    "Financeiro",
    "Boleto e PIX",
    "Manutenções",
    "Investidores",
    "Rastreamento",
    "CRM + WhatsApp + IA",
    "Multas e Sinistros",
    "Vistorias",
    "Assinatura Digital",
    "Relatórios",
  ];
  mods.forEach((m, i) => {
    ctx.fillText(`• ${m}`, 40, 180 + i * 28);
  });
  ctx.fillText("Mais controle · Menos trabalho · Mais lucro", 40, 600);
  return Buffer.from(canvas.toBuffer("image/png"));
}

export function gravarPngCampanha(): string {
  const dest = path.join(os.tmpdir(), "Campanha-Locadoras.png");
  writeFileSync(dest, pngCampanhaLocadoras());
  return dest;
}
