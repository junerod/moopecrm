/**
 * Envelope de e-mail da campanha — o MESMO texto do composer, com casca da marca.
 * Sem segundo editor.
 */
export interface RodapeDoEnvelope {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
}

export interface EnvelopeDaCampanha {
  subject: string;
  html: string;
  text: string;
}

function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragrafos(texto: string): string {
  return texto
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;line-height:1.5">${escapar(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export function montarEnvelopeDeEmail(input: {
  nomeCampanha: string;
  corpo: string;
  rodape: RodapeDoEnvelope;
  logoUrl?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  midiaUrl?: string | null;
  midiaKind?: "image" | "video" | "document" | null;
  accentHex?: string | null;
}): EnvelopeDaCampanha {
  const accent = input.accentHex ?? "#1e3a5f";
  const logo = input.logoUrl
    ? `<img src="${escapar(input.logoUrl)}" alt="${escapar(input.rodape.nome)}" style="max-height:40px;margin-bottom:16px" />`
    : "";
  const midia =
    input.midiaKind === "image" && input.midiaUrl
      ? `<p><img src="${escapar(input.midiaUrl)}" alt="" style="max-width:100%;border-radius:8px" /></p>`
      : input.midiaUrl
        ? `<p><a href="${escapar(input.midiaUrl)}">Abrir anexo</a></p>`
        : "";
  const cta =
    input.ctaUrl
      ? `<p style="margin:20px 0"><a href="${escapar(input.ctaUrl)}" style="background:${accent};color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">${escapar(input.ctaLabel ?? "Saiba mais")}</a></p>`
      : "";
  const linhasRodape = [
    input.rodape.nome,
    input.rodape.telefone,
    input.rodape.email,
    input.rodape.endereco,
  ]
    .filter(Boolean)
    .map((l) => escapar(String(l)))
    .join("<br/>");

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f4f4f5;font-family:sans-serif">
  <div style="max-width:560px;margin:24px auto;background:#fff;padding:24px;border-radius:12px">
    ${logo}
    ${paragrafos(input.corpo)}
    ${midia}
    ${cta}
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0" />
    <p style="font-size:12px;color:#71717a;line-height:1.5">${linhasRodape}</p>
    <p style="font-size:12px;color:#71717a">Se não quiser mais receber mensagens desta empresa, responda pedindo para sair da lista.</p>
  </div>
</body></html>`;

  const text = [
    input.corpo,
    input.ctaUrl ? `${input.ctaLabel ?? "Saiba mais"}: ${input.ctaUrl}` : "",
    "",
    [input.rodape.nome, input.rodape.telefone, input.rodape.email, input.rodape.endereco]
      .filter(Boolean)
      .join(" · "),
    "Para sair da lista, responda pedindo para não receber mais.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject: input.nomeCampanha, html, text };
}
