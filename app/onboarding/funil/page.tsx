import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { dadosDoPasso } from "@/app/actions/onboarding/montarQuadro";
import { QuadroClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function FunilPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");

  const { atual, proposta, rotulo, editavel } = await dadosDoPasso(activeOrg.orgId);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Como o atendimento será organizado
        </h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          Cada contato caminha por estas etapas. Não precisa entender funil —
          é só o caminho do atendimento.
        </p>
      </header>
      <QuadroClient atual={atual} propostaInicial={proposta} rotulo={rotulo} editavel={editavel} />
    </div>
  );
}
