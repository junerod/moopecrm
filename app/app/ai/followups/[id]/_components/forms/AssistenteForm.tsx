"use client";

import Link from "next/link";

import { assistenteConfigSchema } from "@/lib/followup/graph-schema";

import type { ConfigOf } from "./shared";

export interface AssistenteDoFluxo {
  id: string;
  name: string;
  publicado: boolean;
}

export function AssistenteForm({
  config,
  onChange,
  assistentes = [],
}: {
  config: ConfigOf<"assistente">;
  onChange: (c: ConfigOf<"assistente">) => void;
  assistentes?: AssistenteDoFluxo[];
}) {
  function escolher(agentId: string | undefined) {
    const parsed = assistenteConfigSchema.safeParse(
      agentId ? { ...config, agent_id: agentId } : { specialty: config.specialty },
    );
    if (parsed.success) onChange(parsed.data);
  }

  const publicados = assistentes.filter((a) => a.publicado);
  const rascunhos = assistentes.filter((a) => !a.publicado);

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Qual assistente assume</legend>
      <p className="text-xs leading-relaxed text-text-muted">
        Este bloco encerra o menu. A próxima mensagem do cliente é respondida pelo
        assistente que você marcar — o mesmo criado em Assistentes de IA. Ele precisa
        estar publicado.
      </p>
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
            Quem já está publicado neste número. Use quando só existe um.
          </span>
        </span>
      </label>
      {publicados.map((a) => (
        <label
          key={a.id}
          className="flex cursor-pointer items-start gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm dark:border-violet-800 dark:bg-violet-950/40"
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
              Publicado · criado em Assistentes de IA
            </span>
          </span>
        </label>
      ))}
      {rascunhos.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-dashed border-border px-3 py-2">
          <p className="text-xs font-medium text-text-muted">Ainda não dá para ligar</p>
          <ul className="text-xs text-text-muted">
            {rascunhos.map((a) => (
              <li key={a.id}>{a.name} — publique em Assistentes de IA</li>
            ))}
          </ul>
        </div>
      ) : null}
      {assistentes.length === 0 ? (
        <p className="text-xs text-text-muted">
          Nenhum assistente nesta organização.{" "}
          <Link href="/app/ai/agents" className="font-medium text-accent underline underline-offset-2">
            Criar em Assistentes de IA
          </Link>
        </p>
      ) : (
        <p className="text-xs text-text-muted">
          <Link href="/app/ai/agents" className="font-medium text-accent underline underline-offset-2">
            Abrir Assistentes de IA
          </Link>{" "}
          para criar ou publicar outro.
        </p>
      )}
    </fieldset>
  );
}
