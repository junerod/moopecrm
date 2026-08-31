/**
 * Cria (ou atualiza) um tenant de locadora.
 *
 * Irmão de `provisionar-escritorio-advocacia.ts`. O quadro de e-commerce que
 * o gatilho semeia é trocado pelos funis do perfil
 * (`lib/onboarding/perfil-locadora.ts`).
 *
 *   OWNER_EMAIL=gestor@locadora.com OWNER_PASSWORD='…' \
 *   OWNER_ORG_NAME='Locadora Norte' \
 *   npx tsx scripts/provisionar-locadora.ts
 *
 * Para entrar numa organização que já existe:
 *   OWNER_ORG_ID=<uuid> ...
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

import { aplicarPerfilLocadora } from "../lib/onboarding/perfil-locadora";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  for (const file of [".env", ".env.local"]) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !out[m[1]!]) out[m[1]!] = m[2]!.replace(/^"(.*)"$/, "$1");
    }
  }
  return out;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = env.OWNER_EMAIL;
const PASSWORD = env.OWNER_PASSWORD;
const ORG_NAME = env.OWNER_ORG_NAME || "Locadora";
const ORG_ID_EXISTENTE = (env.OWNER_ORG_ID ?? "").trim();

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
}
if (!EMAIL || !PASSWORD) {
  throw new Error("Faltam OWNER_EMAIL / OWNER_PASSWORD.");
}
if (PASSWORD.length < 8) {
  throw new Error("OWNER_PASSWORD precisa ter pelo menos 8 caracteres.");
}

function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "locadora"
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureUser(): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = list.users.find((u) => u.email === EMAIL);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    console.log(`[provisionar] usuário já existia, senha atualizada: ${existing.id}`);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: ORG_NAME },
  });
  if (error || !data?.user) throw new Error(`criar usuário: ${error?.message}`);
  console.log(`[provisionar] usuário criado: ${data.user.id}`);
  return data.user.id;
}

async function ensureOrg(ownerId: string): Promise<string> {
  if (ORG_ID_EXISTENTE) {
    const { data, error } = await admin
      .from("organizations")
      .select("id")
      .eq("id", ORG_ID_EXISTENTE)
      .maybeSingle();
    if (error || !data) throw new Error(`OWNER_ORG_ID não existe: ${error?.message ?? ORG_ID_EXISTENTE}`);
    if (env.OWNER_ORG_NAME) {
      const { error: erroNome } = await admin
        .from("organizations")
        .update({ display_name: ORG_NAME, legal_name: ORG_NAME } as never)
        .eq("id", ORG_ID_EXISTENTE);
      if (erroNome) throw new Error(`renomear org: ${erroNome.message}`);
      console.log(`[provisionar] org existente renomeada para ${ORG_NAME}`);
    } else {
      console.log(`[provisionar] usando org existente: ${ORG_ID_EXISTENTE}`);
    }
    return (data as { id: string }).id;
  }
  const slug = slugify(ORG_NAME);
  const { data: existing } = await admin.from("organizations").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    const id = (existing as { id: string }).id;
    console.log(`[provisionar] org já existia: ${id}`);
    return id;
  }
  const { data, error } = await admin
    .from("organizations")
    .insert({
      slug,
      display_name: ORG_NAME,
      legal_name: ORG_NAME,
      created_by: ownerId,
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(`criar org: ${error?.message}`);
  const orgId = (data as { id: string }).id;
  console.log(`[provisionar] org criada: ${orgId}`);
  return orgId;
}

async function ensureMembership(userId: string, orgId: string): Promise<void> {
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
    console.log("[provisionar] associação admin garantida");
    return;
  }
  const { error } = await admin.from("user_organizations").insert({
    user_id: userId,
    organization_id: orgId,
    role: "admin",
    accepted_at: new Date().toISOString(),
  } as never);
  if (error) throw new Error(`associação: ${error.message}`);
  console.log("[provisionar] usuário associado como admin");
}

async function marcarOnboarded(orgId: string): Promise<void> {
  const { error } = await admin
    .from("organizations")
    .update({
      onboarded_at: new Date().toISOString(),
      onboarding_state: {
        welcome: {
          o_que_faz: "Locadora de carros para motorista de app",
          display_name: ORG_NAME,
          timezone: "America/Sao_Paulo",
        },
        funil: { origem: "pacote", etapas: 7 },
      },
    } as never)
    .eq("id", orgId)
    .is("onboarded_at", null);
  if (error) throw new Error(`marcar onboarded: ${error.message}`);
}

async function main(): Promise<void> {
  const userId = await ensureUser();
  const orgId = await ensureOrg(userId);
  await ensureMembership(userId, orgId);
  const perfil = await aplicarPerfilLocadora(admin, orgId);
  await marcarOnboarded(orgId);
  console.log(
    [
      "",
      "✅ Locadora pronta.",
      `  usuário: ${EMAIL}`,
      `  org:     ${orgId}`,
      `  funil:   locatários ${perfil.pipelineLocatariosId}`,
      `  funil:   cobrança ${perfil.pipelineCobrancaId}`,
      `  login:   ${env.NEXT_PUBLIC_APP_URL || "https://<seu-dominio>"}`,
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error("❌ Provisionar locadora falhou:", err);
  process.exit(1);
});
