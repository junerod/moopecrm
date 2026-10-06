"use client";

import Link from "next/link";
import { useState } from "react";

import { garantirAssistenteLocadoraAction } from "@/app/actions/ai/garantirAssistenteLocadora";
import { assistenteConfigSchema } from "@/lib/followup/graph-schema";

import type { ConfigOf } from "./shared";

export interface AssistenteDoFluxo {
  id: string;
  name: string;
  publicado: boolean;
}

const NOME_LOCADORA = "Atendimento locadora";

export function AssistenteForm({
  config,
  onChange,
  assistentes = [],
}: {
  config: ConfigOf<"assistente">;
  onChange: (c: ConfigOf<"assistente">) => void;
  assistentes?: AssistenteDoFluxo[];
}) {
  const [criando, setCriando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [extra, setExtra] = useState<AssistenteDoFluxo | null>(null);

  const lista =
    extra && !assistentes.some((a) => a.id === extra.id) ? [...assistentes, extra] : assistentes;
  const publicados = lista.filter((a) => a.publicado);
  const rascunhos = lista.filter((a) => !a.publicado);
  const temLocadora = lista.some((a) => a.name === NOME_LOCADORA);

  function escolher(agentId: string | undefined) {
    const parsed = assistenteConfigSchema.safeParse(
      agentId ? { agent_id: agentId } : {},
    );
    if (parsed.success) onChange(parsed.data);
  }

  async function criarLocadora() {
    setCriando(true);
    setAviso(null);
    try {
      const r = await garantirAssistenteLocadoraAction();
      setAviso(r.message);
      if (!r.ok) return;
      setExtra({ id: r.agent_id, name: r.name, publicado: r.publicado });
      if (r.publicado) escolher(r.agent_id);
    } finally {
      setCriando(false);
    }
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Qual assistente de IA responde</legend>
      <p className="text-xs leading-relaxed text-text-muted">
        A lista é a de Assistentes de IA. Marque um publicado. Este bloco encerra o
        menu e a próxima mensagem do cliente cai nesse assistente.
      </p>
      {publicados.length === 0 ? (
        <div className="rounded-xl border border-amber-400/50 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          Nenhum assistente publicado. Crie o da locadora aqui, ou publique um em
          Assistentes de IA e volte neste bloco.
        </div>
      ) : null}
      {publicados.map((a) => (
        <label
          key={a.id}
          className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
            config.agent_id === a.id
              ? "border-violet-500 bg-violet-50 ring-2 ring-violet-400/40 dark:bg-violet-950/40"
              : "border-violet-300 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/20"
          }`}
        >
          <input
            type="radio"
            name="assistente-do-fluxo"
            className="mt-1"
            checked={config.agent_id === a.id}
            data-testid={`assistente-opcao-${a.id}`}
            onChange={() => escolher(a.id)}
          />
          <span>
            <span className="font-medium">{a.name}</span>
            <span className="mt-0.5 block text-xs text-violet-800/80 dark:text-violet-200/80">
              Publicado · clique para usar neste bloco
            </span>
          </span>
        </label>
      ))}
      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
        <input
          type="radio"
          name="assistente-do-fluxo"
          className="mt-1"
          checked={!config.agent_id}
          data-testid="assistente-deste-numero"
          onChange={() => escolher(undefined)}
        />
        <span>
          <span className="font-medium">O assistente deste WhatsApp</span>
          <span className="mt-0.5 block text-xs text-text-muted">
            Só use se este número já tem um assistente publicado e você não quer outro.
          </span>
        </span>
      </label>
      {rascunhos.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-dashed border-border px-3 py-2">
          <p className="text-xs font-medium text-text-muted">Ainda não dá para ligar</p>
          <ul className="text-xs text-text-muted">
            {rascunhos.map((a) => (
              <li key={a.id}>
                {a.name} —{" "}
                <Link href={`/app/ai/agents/${a.id}`} className="underline underline-offset-2">
                  publique
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {!temLocadora ? (
        <button
          type="button"
          className="w-full rounded-xl bg-violet-600 px-3 py-2 text-left text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          disabled={criando}
          data-testid="criar-assistente-locadora"
          onClick={() => void criarLocadora()}
        >
          {criando ? "Criando…" : "Criar atendimento da locadora"}
          <span className="mt-0.5 block text-xs font-normal text-violet-100">
            Boleto, contrato, cliente e ofertas pela Moope. Precisa da integração ligada.
          </span>
        </button>
      ) : null}
      {aviso ? <p className="text-xs text-text-muted">{aviso}</p> : null}
      <p className="text-xs text-text-muted">
        <Link href="/app/ai/agents" className="font-medium text-accent underline underline-offset-2">
          Abrir Assistentes de IA
        </Link>
      </p>
    </fieldset>
  );
}
