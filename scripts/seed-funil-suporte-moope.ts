/**
 * One-shot: garante funil Suporte na org "Comercial MOOPE" (ou nome via argv).
 *
 * Uso:
 *   pnpm exec tsx scripts/seed-funil-suporte-moope.ts
 *   pnpm exec tsx scripts/seed-funil-suporte-moope.ts "Comercial MOOPE"
 *
 * Precisa de SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ou o .env.local do repo).
 */
import { createClient } from "@supabase/supabase-js";

import { garantirFunilSuporte } from "../lib/pipelines/garantir-funil-suporte";

const NOME_DEFAULT = "Comercial MOOPE";

async function main() {
  const nomeOrg = process.argv[2]?.trim() || NOME_DEFAULT;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltam SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, display_name, legal_name")
    .or(`display_name.ilike.%${nomeOrg}%,legal_name.ilike.%${nomeOrg}%`);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (!orgs?.length) {
    console.error(`Nenhuma organização bate com «${nomeOrg}».`);
    process.exit(1);
  }
  if (orgs.length > 1) {
    console.error(
      `Várias orgs batem com «${nomeOrg}»:`,
      orgs.map((o) => `${o.display_name} (${o.id})`).join(", "),
    );
    process.exit(1);
  }

  const org = orgs[0]!;
  const result = await garantirFunilSuporte(admin, org.id as string);
  console.log(
    result.criado
      ? `Criado funil Suporte em «${org.display_name}»: ${result.pipelineId}`
      : `Já existia funil Suporte em «${org.display_name}»: ${result.pipelineId}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
