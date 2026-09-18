"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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
    nome: "Primeiro atendimento",
    explica: "A primeira mensagem vira um menu: advogado, horário, agendar e dúvida.",
    nomeDoBot: "Recepção",
    classe: "border-amber-500/40 bg-amber-500/10",
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
        <p className="mt-0.5 max-w-2xl text-sm text-[var(--color-text-muted)]">
          O bot de primeiro atendimento responde a primeira mensagem neste WhatsApp.
          Escolha um atalho. O desenho entra pronto. Você só muda o texto, salva e publica.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
