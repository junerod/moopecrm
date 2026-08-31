/**
 * Cria (ou reusa) o dono de um tenant e manda o e-mail de entrada.
 *
 * Senha inicial só é gravada em usuário NOVO. Conta que já existia continua
 * com a senha dela — criar um tenant não pode resetar o login de outra empresa.
 */
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/resend";
import { buildBoasVindasDoTenant } from "@/lib/email/templates/boas-vindas-tenant";
import { marcaDaSaida } from "@/lib/branding/saida";

export type DonoProvisionado = {
  userId: string;
  email: string;
  criadoAgora: boolean;
  senhaDefinidaAqui: boolean;
  emailEnviado: boolean;
  definirSenhaUrl: string | null;
};

async function acharUsuarioPorEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string } | null> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listar usuários: ${error.message}`);
    const achado = data.users.find((u) => u.email?.trim().toLowerCase() === email);
    if (achado) return { id: achado.id };
    if (data.users.length < 200) return null;
  }
  return null;
}

async function garantirMembroAdmin(
  admin: SupabaseClient,
  userId: string,
  orgId: string,
): Promise<void> {
  const { data: existing } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (existing) {
    await admin
      .from("user_organizations")
      .update({ role: "admin", revoked_at: null, accepted_at: new Date().toISOString() } as never)
      .eq("user_id", userId)
      .eq("organization_id", orgId);
    return;
  }
  const { error } = await admin.from("user_organizations").insert({
    user_id: userId,
    organization_id: orgId,
    role: "admin",
    accepted_at: new Date().toISOString(),
  } as never);
  if (error) throw new Error(`associar dono: ${error.message}`);
}

export async function provisionarDonoDoTenant(
  admin: SupabaseClient,
  args: {
    orgId: string;
    orgName: string;
    email: string;
    senha?: string | null;
  },
): Promise<DonoProvisionado> {
  const email = args.email.trim().toLowerCase();
  const senhaNova = args.senha?.trim() ?? "";
  const jaTinha = await acharUsuarioPorEmail(admin, email);

  let userId: string;
  let criadoAgora = false;
  let senhaDefinidaAqui = false;
  let definirSenhaUrl: string | null = null;

  if (jaTinha) {
    userId = jaTinha.id;
  } else {
    const senha = senhaNova.length >= 8 ? senhaNova : randomBytes(24).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { full_name: args.orgName },
    });
    if (error || !data.user) throw new Error(`criar dono: ${error?.message ?? "sem usuário"}`);
    userId = data.user.id;
    criadoAgora = true;
    senhaDefinidaAqui = senhaNova.length >= 8;
    if (!senhaDefinidaAqui) {
      const { data: link, error: erroLink } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/auth/confirm?type=recovery` },
      });
      if (erroLink) throw new Error(`link de senha: ${erroLink.message}`);
      definirSenhaUrl = link.properties?.action_link ?? null;
    }
  }

  await garantirMembroAdmin(admin, userId, args.orgId);

  const marca = await marcaDaSaida(args.orgId);
  const loginUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/login`;
  const { subject, html, text } = buildBoasVindasDoTenant({
    orgName: args.orgName,
    loginUrl,
    senha: senhaDefinidaAqui ? senhaNova : undefined,
    definirSenhaUrl: definirSenhaUrl ?? undefined,
    marca,
  });
  const envio = await sendEmail({ to: email, subject, html, text, fromName: marca.nome });

  return {
    userId,
    email,
    criadoAgora,
    senhaDefinidaAqui,
    emailEnviado: envio.ok,
    definirSenhaUrl: envio.ok ? null : definirSenhaUrl,
  };
}
