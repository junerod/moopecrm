import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Token só nos pixels — não existe em TXT/MD/PDF auxiliar. */
export const TOKEN_VISUAL_CAMPANHA = "VISION-MOOPE-7319";

/** PNG comercial de teste — não depende de arquivo privado. */
export function pngCampanhaLocadoras(): Buffer {
  const canvas = createCanvas(900, 700);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0B1F3A";
  ctx.fillRect(0, 0, 900, 700);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText("MOOPE", 40, 70);
  ctx.font = "24px sans-serif";
  ctx.fillText("Sua locadora cresceu. Sua gestão acompanhou?", 40, 120);
  ctx.font = "18px sans-serif";
  const mods = [
    "Locações e contratos",
    "Financeiro e cobranças",
    "Boleto e PIX",
    "Manutenções",
    "Gestão de investidores",
    "Rastreamento",
    "CRM + WhatsApp + IA",
    "Multas e sinistros",
    "Vistorias",
    "Assinatura digital",
    "Relatórios",
  ];
  mods.forEach((m, i) => {
    ctx.fillText(`• ${m}`, 40, 170 + i * 28);
  });
  ctx.fillStyle = "#FDE68A";
  ctx.font = "bold 42px sans-serif";
  ctx.fillText(TOKEN_VISUAL_CAMPANHA, 40, 520);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "20px sans-serif";
  ctx.fillText(`Código exclusivo: ${TOKEN_VISUAL_CAMPANHA}`, 40, 560);
  ctx.font = "18px sans-serif";
  ctx.fillText("Mais controle · Menos trabalho · Mais lucro", 40, 660);
  return Buffer.from(canvas.toBuffer("image/png"));
}

export function gravarPngCampanha(): string {
  const dest = path.join(os.tmpdir(), "Campanha-Locadoras.png");
  writeFileSync(dest, pngCampanhaLocadoras());
  return dest;
}
