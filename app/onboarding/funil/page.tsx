import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { dadosDoPasso } from "@/app/actions/onboarding/montarQuadro";
import { QuadroClient } from "./_client";

export const dynamic = "force-dynamic";

/**
 * "Onde ele organiza" — o quadro de clientes.
 *
 * O gatilho `trg_seed_default_pipeline_for_org` semeia o MESMO funil de
 * e-commerce em toda organização: "Carrinho abandonado", "Em separação",
 * "Enviado". A clínica que instalava o sistema abria o quadro dela e lia isso,
 * sem nunca ter sido perguntada em que ramo estava.
 *
 * A sugestão é pedida no RENDER, não num clique: a pessoa chega no passo com a
 * proposta já na tela. Mandar clicar em "gerar sugestão" antes cobraria um passo
 * a mais para chegar exatamente ao mesmo lugar.
 */
export default async function FunilPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");

  const { atual, sugestao } = await dadosDoPasso(activeOrg.orgId, activeOrg.name);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Monte o funil da sua operação
        </h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          Cada cliente vira um cartão nessas colunas. O agente de IA usa este
          funil para saber em que passo cada pessoa está. Dá para ajustar os
          nomes agora ou depois.
        </p>
      </header>
      <QuadroClient atual={atual} sugestao={sugestao} />
    </div>
  );
}
