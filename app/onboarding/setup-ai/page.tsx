import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { lerRetratoDaInstalacao } from "@/lib/instalacao/retrato";
import { SetupAiForm } from "./_form";
import { InteligenciaDele } from "./_inteligencia";
import { capacidadesPadraoDoOnboarding } from "@/lib/ai/agents/capacidades-padrao";
import { TOOL_CATALOG } from "@/lib/mcp/tools/catalog";
import { CONFERENCIAS_DE_SAIDA } from "@/lib/ai/guardrails/lista-de-conferencia";

export const dynamic = "force-dynamic";

/**
 * O passo que era "Configurar IA" e pedia dois campos.
 *
 * Ele é o coração da experiência: é aqui que a pessoa deixa de configurar um
 * sistema e passa a treinar alguém. Além do nome e do jeito de falar, agora
 * pergunta as REGRAS DA CASA — que vão para a memória da organização, valendo
 * para qualquer agente, e não para o prompt deste — e mostra, sem pedir
 * configuração nenhuma, o que ele já vem sabendo fazer e o que nunca vai fazer.
 *
 * As duas listas saem das MESMAS fontes que o runtime usa: as capacidades do
 * pacote que o agente recebe ligado, e as conferências que rodam antes de cada
 * mensagem sair. Escrever essas frases à mão aqui seria a tela prometendo um
 * comportamento que o código não garante.
 */
export default async function SetupAiPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");

  const supabase = await createClient();
  const retrato = await lerRetratoDaInstalacao({ supabase, orgId: activeOrg.orgId });

  const porNome = new Map(TOOL_CATALOG.map((c) => [c.name, c]));
  const capacidades = capacidadesPadraoDoOnboarding()
    .map((id) => porNome.get(id)?.rotulo)
    .filter((r): r is string => Boolean(r));

  const conferencias = CONFERENCIAS_DE_SAIDA.map((c) => c.rotulo);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Treine um agente de IA para trabalhar por você
        </h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          Ele responde no WhatsApp com o jeito da sua empresa. Para pensar, precisa
          de uma chave de uma empresa de IA (Anthropic, OpenAI ou outra). Se ainda
          não contratou, pule — o funil e o WhatsApp funcionam sem isso, e dá para
          voltar depois.
        </p>
      </header>
      {/*
        O cérebro vem ANTES do resto do formulário: sem chave, nada do que a
        pessoa preencher abaixo produz um funcionário que responde. E é aqui que
        a chave passa a importar — um clique antes de ele ser criado com ela.
      */}
      <InteligenciaDele
        inicial={{
          origem: retrato.inteligencia.origemDaChave,
          provedor: retrato.inteligencia.provedor,
          rotulo: retrato.inteligencia.rotulo,
          final: retrato.inteligencia.chaveDaOrg?.final ?? null,
        }}
      />

      <SetupAiForm capacidades={capacidades} conferencias={conferencias} />
    </div>
  );
}
