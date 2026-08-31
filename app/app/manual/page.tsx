import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";

import { ManualDoOperador } from "./_client";

export const metadata = { title: "Como usar" };
export const dynamic = "force-dynamic";

/**
 * Manual do operador — a porta de leitura do sistema.
 *
 * Living System Checklist:
 *  1. Alimenta: `lib/manual/conteudo.ts` (fonte da tela).
 *  2. Alimenta: o operador perdido; Inbox vazio aponta para cá.
 *  3. Registro: leitura pura — sem mutação, sem audit.
 *  4. Tela: esta.
 *  5. Porta: Configurações › Ajuda › Manual + ⌘K + Inbox vazio.
 *  6. Anti-morte: não se aplica (leitura). A busca é o próximo passo de quem
 *     não acha o capítulo.
 *  7. Configuração: o texto é código; quem muda, muda o conteúdo e a tela muda.
 *  8. Continuidade: não se aplica.
 *  9. Laço: capítulo errado se corrige no conteúdo; a busca cobre o vocabulário
 *     que o título não tem (`palavras`).
 * 10. Mapa: `docs/architecture/manual-do-operador.architecture.json`.
 */
export default async function ManualPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  return <ManualDoOperador />;
}
