/**
 * A locadora pede um tenant pronto. O CRM cria organização, dono, funis
 * e a chave mop_ — e devolve o plaintext uma vez, para a locadora gravar.
 *
 * Sem colar chave à mão. WhatsApp ainda é o operador (QR).
 */
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { provisionarDonoDoTenant } from "@/lib/admin/provisionar-dono-do-tenant";
import { env } from "@/lib/env";
import { gerarChaveDeEntrada, gerarSegredoDeSaida } from "@/lib/moope/chave";
import { aplicarPerfilLocadora } from "@/lib/onboarding/perfil-locadora";
import { encryptWebhookSecret } from "@/lib/webhooks/secrets";

export const PISO_DO_SEGREDO_DE_PROVISION = 16;

export type PedidoDeProvisionamento = {
  partner_tenant_id: string;
  display_name: string;
  owner_email: string;
  partner_webhook_url?: string | null;
  partner_api_url?: string | null;
  rotate_keys?: boolean;
};

export type ResultadoDeProvisionamento = {
  organization_id: string;
  slug: string;
  display_name: string;
  public_url: string;
  inbound_key_prefix: string;
  inbound_key?: string;
  outbound_secret?: string;
  criado_agora: boolean;
  chaves_novas: boolean;
  proximo: string;
};

const PROXIMO =
  "Parear o WhatsApp em Canais → Conexões. Sem o número, o Inbox fica pronto e o disparo não sai.";

export function slugDoTenantParceiro(partnerTenantId: string): string {
  const limpo = partnerTenantId.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 20);
  return `loc-${limpo || "x"}`.toLowerCase();
}

export function provisionSecretBate(recebido: string | null, esperado: string): boolean {
  if (!esperado || esperado.length < PISO_DO_SEGREDO_DE_PROVISION) return false;
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function urlPublica(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

export async function provisionarTenantLocadora(
  admin: SupabaseClient,
  pedido: PedidoDeProvisionamento,
): Promise<ResultadoDeProvisionamento> {
  const partnerTenantId = pedido.partner_tenant_id.trim();
  const ja = await acharPorParceiro(admin, partnerTenantId);
  if (ja) {
    return reabrir(admin, ja, pedido);
  }
  return nascer(admin, pedido, partnerTenantId);
}

async function acharPorParceiro(
  admin: SupabaseClient,
  partnerTenantId: string,
): Promise<{
  organization_id: string;
  slug: string;
  display_name: string;
  connection_id: string | null;
  inbound_key_prefix: string | null;
} | null> {
  const { data: conn } = await admin
    .from("moope_connections")
    .select("id, organization_id, inbound_key_prefix")
    .eq("partner_tenant_id", partnerTenantId)
    .maybeSingle();
  if (conn) {
    const { data: org } = await admin
      .from("organizations")
      .select("id, slug, display_name")
      .eq("id", (conn as { organization_id: string }).organization_id)
      .maybeSingle();
    if (!org) return null;
    return {
      organization_id: (org as { id: string }).id,
      slug: String((org as { slug: string }).slug),
      display_name: String((org as { display_name: string }).display_name),
      connection_id: (conn as { id: string }).id,
      inbound_key_prefix: String((conn as { inbound_key_prefix: string }).inbound_key_prefix),
    };
  }

  const slug = slugDoTenantParceiro(partnerTenantId);
  const { data: porSlug } = await admin
    .from("organizations")
    .select("id, slug, display_name")
    .eq("slug", slug)
    .maybeSingle();
  if (!porSlug) return null;
  const { data: connDaOrg } = await admin
    .from("moope_connections")
    .select("id, inbound_key_prefix")
    .eq("organization_id", (porSlug as { id: string }).id)
    .maybeSingle();
  return {
    organization_id: (porSlug as { id: string }).id,
    slug: String((porSlug as { slug: string }).slug),
    display_name: String((porSlug as { display_name: string }).display_name),
    connection_id: connDaOrg ? (connDaOrg as { id: string }).id : null,
    inbound_key_prefix: connDaOrg
      ? String((connDaOrg as { inbound_key_prefix: string }).inbound_key_prefix)
      : null,
  };
}

async function reabrir(
  admin: SupabaseClient,
  ja: NonNullable<Awaited<ReturnType<typeof acharPorParceiro>>>,
  pedido: PedidoDeProvisionamento,
): Promise<ResultadoDeProvisionamento> {
  await garantirDonoEPerfil(admin, ja.organization_id, pedido);
  if (!ja.connection_id) {
    const chaves = await gravarConexao(admin, {
      organizationId: ja.organization_id,
      partnerTenantId: pedido.partner_tenant_id.trim(),
      webhook: pedido.partner_webhook_url,
      apiUrl: pedido.partner_api_url,
      userId: null,
    });
    return {
      organization_id: ja.organization_id,
      slug: ja.slug,
      display_name: ja.display_name,
      public_url: urlPublica(),
      inbound_key_prefix: chaves.prefix,
      inbound_key: chaves.plaintext,
      outbound_secret: chaves.saida,
      criado_agora: false,
      chaves_novas: true,
      proximo: PROXIMO,
    };
  }

  if (pedido.rotate_keys) {
    const chaves = await rotacionarConexao(admin, ja.connection_id, ja.organization_id);
    return {
      organization_id: ja.organization_id,
      slug: ja.slug,
      display_name: ja.display_name,
      public_url: urlPublica(),
      inbound_key_prefix: chaves.prefix,
      inbound_key: chaves.plaintext,
      outbound_secret: chaves.saida,
      criado_agora: false,
      chaves_novas: true,
      proximo: PROXIMO,
    };
  }

  return {
    organization_id: ja.organization_id,
    slug: ja.slug,
    display_name: ja.display_name,
    public_url: urlPublica(),
    inbound_key_prefix: ja.inbound_key_prefix ?? "",
    criado_agora: false,
    chaves_novas: false,
    proximo: PROXIMO,
  };
}

async function nascer(
  admin: SupabaseClient,
  pedido: PedidoDeProvisionamento,
  partnerTenantId: string,
): Promise<ResultadoDeProvisionamento> {
  const slug = await slugLivre(admin, slugDoTenantParceiro(partnerTenantId));
  const { data: org, error } = await admin
    .from("organizations")
    .insert({
      display_name: pedido.display_name.trim(),
      slug,
      status: "active",
      onboarded_at: new Date().toISOString(),
      settings: {
        plan: "standard",
        moope: { partner_tenant_id: partnerTenantId },
      },
    })
    .select("id, slug, display_name")
    .single();
  if (error || !org) {
    throw new Error(error?.message ?? "não criei a organização");
  }

  const orgId = (org as { id: string }).id;
  await garantirDonoEPerfil(admin, orgId, pedido);

  const chaves = await gravarConexao(admin, {
    organizationId: orgId,
    partnerTenantId,
    webhook: pedido.partner_webhook_url,
    apiUrl: pedido.partner_api_url,
    userId: null,
  });

  return {
    organization_id: orgId,
    slug: String((org as { slug: string }).slug),
    display_name: String((org as { display_name: string }).display_name),
    public_url: urlPublica(),
    inbound_key_prefix: chaves.prefix,
    inbound_key: chaves.plaintext,
    outbound_secret: chaves.saida,
    criado_agora: true,
    chaves_novas: true,
    proximo: PROXIMO,
  };
}

async function garantirDonoEPerfil(
  admin: SupabaseClient,
  orgId: string,
  pedido: PedidoDeProvisionamento,
): Promise<void> {
  await provisionarDonoDoTenant(admin, {
    orgId,
    orgName: pedido.display_name.trim(),
    email: pedido.owner_email,
  });
  try {
    await aplicarPerfilLocadora(admin, orgId);
  } catch {
    // Funil padrão ainda não nasceu (gatilho atrasado) — o dono aplica
    // em Configurações › Perfil. A conexão e o login já valem.
  }
  await admin
    .from("organizations")
    .update({
      onboarded_at: new Date().toISOString(),
      display_name: pedido.display_name.trim(),
    } as never)
    .eq("id", orgId)
    .is("onboarded_at", null);
}

async function slugLivre(admin: SupabaseClient, base: string): Promise<string> {
  const { data } = await admin.from("organizations").select("id").eq("slug", base).maybeSingle();
  if (!data) return base;
  const sufixo = Math.random().toString(36).slice(2, 6);
  return `${base.slice(0, 35)}-${sufixo}`;
}

async function gravarConexao(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    partnerTenantId: string;
    webhook?: string | null;
    apiUrl?: string | null;
    userId: string | null;
  },
): Promise<{ plaintext: string; prefix: string; saida: string }> {
  const entrada = gerarChaveDeEntrada();
  const saida = gerarSegredoDeSaida();
  const enc = await encryptWebhookSecret(admin, saida);
  if (!enc) {
    throw new Error("cifra_indisponivel");
  }
  const webhook = args.webhook && args.webhook.length > 0 ? args.webhook : null;
  const apiUrl = args.apiUrl && args.apiUrl.length > 0 ? args.apiUrl : null;
  const { error } = await admin.from("moope_connections").insert({
    organization_id: args.organizationId,
    kind: "locadora",
    partner_webhook_url: webhook,
    partner_api_url: apiUrl,
    partner_tenant_id: args.partnerTenantId,
    inbound_key_prefix: entrada.prefix,
    inbound_key_hash: entrada.hash,
    outbound_secret_enc: enc,
    status: "active",
    created_by_user_id: args.userId,
  } as never);
  if (error) throw new Error(error.message);
  return { plaintext: entrada.plaintext, prefix: entrada.prefix, saida };
}

async function rotacionarConexao(
  admin: SupabaseClient,
  connectionId: string,
  organizationId: string,
): Promise<{ plaintext: string; prefix: string; saida: string }> {
  const entrada = gerarChaveDeEntrada();
  const saida = gerarSegredoDeSaida();
  const enc = await encryptWebhookSecret(admin, saida);
  if (!enc) throw new Error("cifra_indisponivel");
  const { error } = await admin
    .from("moope_connections")
    .update({
      inbound_key_prefix: entrada.prefix,
      inbound_key_hash: entrada.hash,
      outbound_secret_enc: enc,
    } as never)
    .eq("id", connectionId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  return { plaintext: entrada.plaintext, prefix: entrada.prefix, saida };
}
