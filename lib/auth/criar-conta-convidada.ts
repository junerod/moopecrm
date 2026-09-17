/**
 * Conta de quem chegou por convite: o clique no e-mail do convite JÁ prova o
 * endereço. Pedir um segundo e-mail de confirmação do GoTrue trava a pessoa
 * numa tela de "Confirme seu e-mail" quando o correio do Auth não entrega —
 * o caso medido em instalação real.
 *
 * A escrita usa service role pelo mesmo motivo do aceite
 * (`acceptInviteAction`): o convidado ainda não é membro. A autorização é o
 * token HMAC verificado + o e-mail do token === o e-mail do formulário
 * (conferido em `signUp` ANTES de chamar daqui). Senha e e-mail vêm do
 * formulário já validado; organização e papel continuam no token, não aqui.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type ContaConvidada =
  | { ok: true; userId: string; criadaAgora: boolean; jaConfirmada: boolean }
  | { ok: false; motivo: "falha_criar" | "falha_confirmar" };

async function acharUsuarioPorEmail(
  admin: SupabaseClient,
  email: string,
): Promise<User | null> {
  const alvo = email.trim().toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const achado = data.users.find((u) => (u.email ?? "").trim().toLowerCase() === alvo);
    if (achado) return achado;
    if (data.users.length < 200) return null;
  }
  return null;
}

function metadataComConvite(
  atual: User["user_metadata"] | undefined,
  inviteToken: string,
): Record<string, unknown> {
  const base =
    atual && typeof atual === "object" && !Array.isArray(atual)
      ? { ...atual }
      : {};
  return { ...base, invite_token: inviteToken };
}

export async function criarOuConfirmarContaConvidada(
  admin: SupabaseClient,
  args: { email: string; password: string; inviteToken: string },
): Promise<ContaConvidada> {
  const email = args.email.trim().toLowerCase();
  const existente = await acharUsuarioPorEmail(admin, email);

  if (!existente) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: args.password,
      email_confirm: true,
      user_metadata: { invite_token: args.inviteToken },
    });
    if (!error && data.user) {
      return { ok: true, userId: data.user.id, criadaAgora: true, jaConfirmada: true };
    }
    // Corrida: outro pedido criou no meio. Não é e-mail de confirmação —
    // tentamos achar de novo e seguir o caminho de quem já existia.
    const deNovo = await acharUsuarioPorEmail(admin, email);
    if (!deNovo) return { ok: false, motivo: "falha_criar" };
    return confirmarOuReusar(admin, deNovo, args.password, args.inviteToken);
  }

  return confirmarOuReusar(admin, existente, args.password, args.inviteToken);
}

async function confirmarOuReusar(
  admin: SupabaseClient,
  user: User,
  password: string,
  inviteToken: string,
): Promise<ContaConvidada> {
  const jaConfirmada = Boolean(user.email_confirmed_at);
  if (jaConfirmada) {
    // Conta pronta: não resetamos a senha. Quem chama tenta entrar com a
    // senha digitada; se falhar, a action devolve "já tem conta".
    return { ok: true, userId: user.id, criadaAgora: false, jaConfirmada: true };
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: metadataComConvite(user.user_metadata, inviteToken),
  });
  if (error) return { ok: false, motivo: "falha_confirmar" };
  return { ok: true, userId: user.id, criadaAgora: false, jaConfirmada: true };
}
