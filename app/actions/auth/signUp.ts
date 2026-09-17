"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  signupSchema,
  signupComConviteSchema,
  type SignupInput,
  type SignupComConviteInput,
} from "@/lib/auth/schemas";
import { verifyInviteToken } from "@/lib/auth/invite-token";
import { criarOuConfirmarContaConvidada } from "@/lib/auth/criar-conta-convidada";
import { audit, hashEmail } from "@/lib/audit";
import { authRateLimited, AUTH_LIMITS } from "@/lib/auth/rate-limit";
import { env } from "@/lib/env";

export type SignUpResult =
  | { ok: true }
  | {
      ok: false;
      error: "validation_error" | "rate_limited" | "signup_failed" | "account_exists";
      details?: Record<string, unknown>;
    };

/**
 * Signup self-service: cria o usuário no GoTrue e dispara o e-mail de
 * confirmação. O tenant só é provisionado quando o link é confirmado em
 * /auth/confirm (evita orgs órfãs de cadastros nunca confirmados).
 *
 * Convite: o clique no e-mail do convite já prova o endereço. Esse caminho
 * NÃO manda o segundo e-mail do GoTrue — cria (ou confirma) a conta com
 * `email_confirm: true` e entra direto no aceite. Sem isso, instalação sem
 * correio do Auth deixa a pessoa presa em "Confirme seu e-mail".
 *
 * Anti-enumeração no caminho SEM convite: e-mail já cadastrado recebe a MESMA
 * resposta de sucesso — o GoTrue devolve um usuário ofuscado (identities
 * vazio) sem erro, e nós não diferenciamos. Rate limit de envio de e-mail é
 * do próprio GoTrue.
 */
export async function signUp(
  input: SignupInput | SignupComConviteInput,
  /**
   * Token de convite, quando a conta está sendo criada para ACEITAR um convite.
   * Quem decide se ele vale é a assinatura HMAC + o e-mail do formulário
   * (não o campo editável no cliente). Com token válido a conta já nasce
   * confirmada; o `user_metadata.invite_token` continua existindo para o
   * caminho velho de `/auth/confirm` não provisionar empresa fantasma.
   */
  inviteToken?: string,
): Promise<SignUpResult> {
  const temConvite = typeof inviteToken === "string" && inviteToken.trim() !== "";
  const parsed = temConvite
    ? signupComConviteSchema.safeParse(input)
    : signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation_error",
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const hdrs = await headers();
  const origin = hdrs.get("origin") ?? env.NEXT_PUBLIC_APP_URL;
  const requestId = hdrs.get("x-request-id");
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = hdrs.get("user-agent") ?? null;

  // Criar conta é fluxo raro por pessoa: teto baixo por IP evita fábrica de
  // organizações (cada signup provisiona tenant). Issue #64.
  if (await authRateLimited("signup", null, AUTH_LIMITS.signup)) {
    return { ok: false, error: "rate_limited" };
  }

  // Só vira convite se o token verificar E for para este e-mail. Divergência
  // aqui não é erro do usuário — é tentativa de entrar em organização alheia
  // colando um token que chegou para outra pessoa.
  let convite: string | null = null;
  if (temConvite && inviteToken) {
    const payload = verifyInviteToken(inviteToken);
    if (!payload) {
      return { ok: false, error: "validation_error", details: { invite: ["convite_invalido"] } };
    }
    if (payload.email.trim().toLowerCase() !== parsed.data.email.trim().toLowerCase()) {
      return { ok: false, error: "validation_error", details: { invite: ["email_divergente"] } };
    }
    convite = inviteToken;
  }

  if (convite) {
    return entrarPorConvite({
      email: parsed.data.email,
      password: parsed.data.password,
      convite,
      requestId,
      ip,
      userAgent,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Ver comentário equivalente em requestPasswordReset.ts: ?type=signup
      // sobrevive ao redirect do GoTrue e é o que distingue este fluxo do de
      // recovery quando a verificação chega via `code` (PKCE), não `token_hash`.
      emailRedirectTo: `${origin}/auth/confirm?type=signup`,
      data: { org_name: (parsed.data as SignupInput).org_name },
    },
  });

  if (error) {
    if (error.status === 429) return { ok: false, error: "rate_limited" };
    await audit({
      action: "auth.signup_failed",
      metadata: {
        email_hash: hashEmail(parsed.data.email),
        reason: error.message,
      },
      requestId,
      ip,
      userAgent,
    });
    return { ok: false, error: "signup_failed" };
  }

  await audit({
    action: "auth.signup_requested",
    actorUserId: data.user?.id ?? null,
    metadata: { email_hash: hashEmail(parsed.data.email) },
    requestId,
    ip,
    userAgent,
  });

  return { ok: true };
}

async function entrarPorConvite(args: {
  email: string;
  password: string;
  convite: string;
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
}): Promise<SignUpResult> {
  // Service role: o convidado ainda não é membro. Autorização = HMAC do
  // convite (já verificado) + e-mail do token === e-mail do formulário.
  const criada = await criarOuConfirmarContaConvidada(createAdminClient(), {
    email: args.email,
    password: args.password,
    inviteToken: args.convite,
  });
  if (!criada.ok) {
    await audit({
      action: "auth.signup_failed",
      metadata: {
        email_hash: hashEmail(args.email),
        reason: criada.motivo,
        via: "convite",
      },
      requestId: args.requestId,
      ip: args.ip,
      userAgent: args.userAgent,
    });
    return { ok: false, error: "signup_failed" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: args.email,
    password: args.password,
  });

  if (error || !data.user) {
    // Conta já existia confirmada e a senha digitada não é a dela —
    // não enumeramos no caminho comum; aqui o convite já identificou o e-mail.
    await audit({
      action: "auth.signup_failed",
      metadata: {
        email_hash: hashEmail(args.email),
        reason: "account_exists",
        via: "convite",
      },
      requestId: args.requestId,
      ip: args.ip,
      userAgent: args.userAgent,
    });
    return { ok: false, error: "account_exists" };
  }

  await audit({
    action: "auth.signup_requested",
    actorUserId: data.user.id,
    metadata: {
      email_hash: hashEmail(args.email),
      via: "convite",
      criada_agora: criada.criadaAgora,
    },
    requestId: args.requestId,
    ip: args.ip,
    userAgent: args.userAgent,
  });

  redirect(`/team/accept-invite/${args.convite}`);
}
