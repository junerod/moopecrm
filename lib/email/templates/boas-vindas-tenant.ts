/**
 * E-mail de boas-vindas do dono de um tenant recém-criado.
 * Texto e senha inicial só entram quando o operador as definiu na tela.
 */
import { NEUTROS_DE_SAIDA, type MarcaDeSaida } from "@/lib/branding/saida";

export interface BoasVindasDoTenant {
  orgName: string;
  loginUrl: string;
  senha?: string;
  definirSenhaUrl?: string;
  marca: MarcaDeSaida;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildBoasVindasDoTenant(opts: BoasVindasDoTenant): {
  subject: string;
  html: string;
  text: string;
} {
  const marca = opts.marca.nome;
  const subject = `Sua conta na ${opts.orgName} está pronta`;
  const logo = opts.marca.logoUrl
    ? `<p style="margin:0 0 24px"><img src="${escapeHtml(opts.marca.logoUrl)}" alt="${escapeHtml(marca)}" height="40" style="height:40px;width:auto;max-width:200px;border:0;display:block"></p>`
    : "";

  const ctaHref = opts.definirSenhaUrl ?? opts.loginUrl;
  const ctaRotulo = opts.definirSenhaUrl ? "Criar sua senha" : "Entrar";
  const senhaHtml = opts.senha
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Senha inicial: <strong>${escapeHtml(opts.senha)}</strong></p>`
    : "";
  const senhaTxt = opts.senha ? [`Senha inicial: ${opts.senha}`, ""] : [];

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:${NEUTROS_DE_SAIDA.fundo};font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:${NEUTROS_DE_SAIDA.texto}">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    ${logo}
    <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;color:${NEUTROS_DE_SAIDA.texto}">
      Bem-vindo à ${escapeHtml(opts.orgName)}
    </h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
      Sua empresa já está no ${escapeHtml(marca)}. Use o e-mail desta mensagem para entrar.
    </p>
    ${senhaHtml}
    <p style="margin:24px 0">
      <a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:12px 24px;background:${opts.marca.accent};color:${opts.marca.accentFg};border-radius:6px;text-decoration:none;font-weight:600">
        ${ctaRotulo}
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:${NEUTROS_DE_SAIDA.suave}">
      Ou copie: <span style="word-break:break-all;color:${opts.marca.accent}">${escapeHtml(ctaHref)}</span>
    </p>
  </div>
</body>
</html>`;

  const text = [
    `Bem-vindo à ${opts.orgName} no ${marca}.`,
    "",
    ...senhaTxt,
    `${ctaRotulo}: ${ctaHref}`,
  ].join("\n");

  return { subject, html, text };
}
