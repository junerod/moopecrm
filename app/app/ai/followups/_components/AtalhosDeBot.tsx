"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateFollowupFlow } from "@/hooks/followup/useFollowupFlows";
import type { IdDeModeloPronto } from "@/lib/followup/modelo-de-menu";

type Atalho = {
  id: IdDeModeloPronto | "meu";
  nome: string;
  explica: string;
  nomeDoBot: string;
  classe: string;
};

const ATALHOS: Atalho[] = [
  {
    id: "escritorio",
    nome: "Jurídico",
    explica: "Advogado, horário, agendar, dúvida e o outro WhatsApp. A resposta continua neste número.",
    nomeDoBot: "Recepção",
    classe: "border-amber-500/40 bg-amber-500/10",
  },
  {
    id: "locadora",
    nome: "Locadora",
    explica: "Locatário, investidor, carro ou boleto. Os dados vêm do Moope, pelo assistente.",
    nomeDoBot: "Recepção da locadora",
    classe: "border-orange-500/40 bg-orange-500/10",
  },
  {
    id: "loja",
    nome: "Primeiro atendimento da loja",
    explica: "Vendas, horário, dúvida e outro assunto. Já desenhado.",
    nomeDoBot: "Recepção da loja",
    classe: "border-sky-500/40 bg-sky-500/10",
  },
  {
    id: "aviso",
    nome: "Só avisar a equipe",
    explica: "Sem menu. A pessoa escreve e a equipe lê um comentário na Central.",
    nomeDoBot: "Avisar a equipe",
    classe: "border-emerald-500/40 bg-emerald-500/10",
  },
  {
    id: "meu",
    nome: "Montar o meu",
    explica: "Um passo a passo pergunta o nome, quantas opções e o que cada uma faz.",
    nomeDoBot: "Meu bot",
    classe: "border-violet-500/40 bg-violet-500/10",
  },
];

export function AtalhosDeBot({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const criar = useCreateFollowupFlow();
  const [qual, setQual] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function usar(atalho: Atalho) {
    setErro(null);
    setQual(atalho.id);
    criar.mutate(
      { name: atalho.nomeDoBot, purpose: "bot" },
      {
        onSuccess: (criado) => {
          router.push(`/app/ai/followups/${criado.id}?modelo=${atalho.id}`);
        },
        onError: () => {
          setQual(null);
          setErro("Não consegui criar. Se já existe um bot com esse nome, apague o antigo ou use Novo bot.");
        },
      },
    );
  }

  return (
    <section className="space-y-3" data-testid="atalhos-de-bot">
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Como começar</h2>
        <p className="mt-0.5 max-w-3xl text-sm text-[var(--color-text-muted)]">
          Escolha um atalho. O desenho entra pronto. Publique só um bot de primeira mensagem —
          dois publicados respondem juntos.
        </p>
      </div>
      <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm leading-relaxed text-[var(--color-text)]">
        <p className="font-medium">Locadora e o Moope</p>
        <p className="mt-1 text-[var(--color-text-muted)]">
          Locatário, investidor, carro disponível e boleto não são texto fixo. Essas opções
          soltam o assistente, que consulta o Moope e só fala o que encontrar. Socorro e
          equipe chamam uma pessoa nesta mesma conversa. Troque o texto do horário e do
          outro WhatsApp no jurídico antes de publicar — a pessoa continua no número em que escreveu.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {ATALHOS.map((atalho) => (
          <button
            key={atalho.id}
            type="button"
            disabled={!canWrite || criar.isPending}
            onClick={() => usar(atalho)}
            data-testid={`atalho-${atalho.id}`}
            className={`rounded-xl border px-3 py-3 text-left disabled:opacity-60 ${atalho.classe}`}
          >
            <span className="block text-sm font-semibold">{atalho.nome}</span>
            <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">{atalho.explica}</span>
            {qual === atalho.id ? (
              <span className="mt-2 block text-xs font-medium">Abrindo o quadro…</span>
            ) : null}
          </button>
        ))}
      </div>
      {!canWrite ? (
        <p className="text-xs text-[var(--color-text-muted)]">Quem cria o bot é um gerente ou administrador.</p>
      ) : null}
      {erro ? <p className="text-sm text-red-600 dark:text-red-400">{erro}</p> : null}
    </section>
  );
}
