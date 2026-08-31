/**
 * Grava `platform_branding.app_name = MOOPE CRM` na instalação.
 *
 * O fallback do código já é MOOPE CRM. Este script cobre a linha do banco
 * que o `install.sh` semeou com o nome antigo (ou deixou vazia). Não toca
 * `seeded_from_env = false` — escolha humana pela tela `/admin/marca` fica.
 *
 *   npx tsx scripts/gravar-marca-moope.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

import { DEFAULT_APP_NAME } from "../lib/branding";

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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main(): Promise<void> {
  const { data: linha, error } = await admin
    .from("platform_branding")
    .select("id, app_name, seeded_from_env")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (linha && linha.seeded_from_env === false && (linha.app_name ?? "").trim()) {
    console.log(
      `[marca] a tela já gravou "${linha.app_name}" — não sobrescrevo escolha humana.`,
    );
    return;
  }

  const { error: upsertErr } = await admin.from("platform_branding").upsert({
    id: 1,
    app_name: DEFAULT_APP_NAME,
    seeded_from_env: true,
  } as never);
  if (upsertErr) throw new Error(upsertErr.message);
  console.log(`[marca] platform_branding.app_name = ${DEFAULT_APP_NAME}`);
}

main().catch((err) => {
  console.error("❌ gravar marca falhou:", err);
  process.exit(1);
});
