import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { ApiTokensClient } from "./_components/ApiTokensClient";

export const dynamic = "force-dynamic";

export default async function ApiTokensPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg || ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    redirect("/403");
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tokens de API</h1>
        <p className="text-sm text-muted-foreground">
          Um token por sistema. Você escolhe o nome e a validade, e pode revogar sem
          afetar os outros. O texto da chave aparece uma vez. Ler mostra agenda, funil
          e indicadores. Mexer no funil deixa o outro sistema arrastar o card, ganhar,
          perder e marcar o próximo passo — a mudança entra aqui na hora. Quem abre
          a tela lá é regra de lá.
        </p>
      </header>
      <ApiTokensClient />
    </div>
  );
}
