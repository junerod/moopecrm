/**
 * Reset de tenant de TESTE. Dry-run por padrão.
 *
 * Recusa:
 * - host que não é localhost
 * - organization_id ausente
 * - UUID conhecido da VPS de produção, salvo --allow-cloned-prod-uuid
 *
 * 8f4b9d4d-e9a2-49ff-8e48-b5001b3fae88 é clone de tenant vivo — não usar
 * para onboarding/reset. Na VPS este UUID é MOOPE Tecnologia (produção).
 * No Postgres local 54321 o mesmo id aparece como Rodrigues Advogados e
 * carrega o dump (contatos, mensagens, sessões). Preservar. Onboarding
 * limpo = criar organização nova com UUID novo, nunca wipe deste id.
 *
 * Não toca channel_sessions sem --include-channels.
 *
 * Uso:
 *   pnpm exec tsx scripts/reset-test-tenant.ts --org <uuid>
 *   pnpm exec tsx scripts/reset-test-tenant.ts --org <uuid> --execute
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** clone de tenant vivo — não usar para onboarding/reset */
const PROD_CLONED = "8f4b9d4d-e9a2-49ff-8e48-b5001b3fae88";

const TABELAS = [
  "messages",
  "conversations",
  "crm_lead_activities",
  "crm_lead_links",
  "crm_leads",
  "demandas",
  "contacts",
  "crm_stages",
  "crm_pipelines",
] as const;

function envLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return out;
}

function arg(nome: string): string | null {
  const i = process.argv.indexOf(nome);
  if (i < 0) return null;
  return process.argv[i + 1] ?? null;
}

async function main() {
  const org = arg("--org");
  const execute = process.argv.includes("--execute");
  const allowCloned = process.argv.includes("--allow-cloned-prod-uuid");
  const includeChannels = process.argv.includes("--include-channels");
  if (!org) {
    console.error("exige --org <uuid>");
    process.exit(2);
  }

  const env = envLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
    console.error("recusado: SUPABASE não é local:", url);
    process.exit(2);
  }
  if (org === PROD_CLONED && !allowCloned) {
    console.error(
      "recusado: este UUID é o tenant da VPS (MOOPE Tecnologia). " +
        "No local ele aparece como Rodrigues Advogados. Passe --allow-cloned-prod-uuid só se for 54321.",
    );
    process.exit(2);
  }

  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: row, error } = await admin
    .from("organizations")
    .select("id, legal_name, display_name, slug, onboarded_at")
    .eq("id", org)
    .maybeSingle();
  if (error || !row) {
    console.error("org não encontrada", error?.message);
    process.exit(2);
  }
    console.info("ALVO", {
    id: row.id,
    legal_name: row.legal_name,
    display_name: row.display_name,
    slug: row.slug,
    onboarded_at: row.onboarded_at,
    supabase: url,
    execute,
    includeChannels,
  });

  for (const tabela of TABELAS) {
    const { count, error: err } = await admin
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org);
    if (err) console.error("  ", tabela, "ERRO", err.message);
    else console.info("  ", tabela, count ?? 0);
  }
  const { count: canais } = await admin
    .from("channel_sessions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org);
  console.info("  ", "channel_sessions", canais ?? 0, includeChannels ? "(seria apagado)" : "(PRESERVAR)");

  if (!execute) {
    console.info("DRY-RUN. Nada foi apagado. Passe --execute para apagar as tabelas acima.");
    return;
  }

  for (const tabela of TABELAS) {
    const { error: err, count } = await admin
      .from(tabela)
      .delete({ count: "exact" })
      .eq("organization_id", org);
    if (err) {
      console.error("FALHOU", tabela, err.message);
      process.exit(1);
    }
    console.info("apagou", tabela, count ?? 0);
  }
  if (includeChannels) {
    const { error: err, count } = await admin
      .from("channel_sessions")
      .delete({ count: "exact" })
      .eq("organization_id", org);
    if (err) {
      console.error("FALHOU channel_sessions", err.message);
      process.exit(1);
    }
    console.info("apagou channel_sessions", count ?? 0);
  }

  const { error: errOrg } = await admin
    .from("organizations")
    .update({
      onboarded_at: null,
      onboarding_state: {},
    } as never)
    .eq("id", org);
  if (errOrg) {
    console.error("FALHOU reset onboarding", errOrg.message);
    process.exit(1);
  }
  console.info("onboarded_at anulado. Login de novo para onboarding limpo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
