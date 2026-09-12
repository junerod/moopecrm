"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ListaDeAcoes } from "@/components/comercial/ListaDeAcoes";
import { useProximasAcoes } from "@/hooks/comercial/useProximasAcoes";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useConversationCounts } from "@/hooks/inbox/useConversationCounts";
import { useAtRiskLeads } from "@/hooks/leads/useAtRiskLeads";

function Bloco({
  href,
  numero,
  rotulo,
  carregando,
  destaque,
}: {
  href: string;
  numero: number;
  rotulo: string;
  carregando?: boolean;
  destaque?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        destaque
          ? "block rounded-lg bg-destructive/10 px-4 py-3 transition-colors hover:bg-destructive/15"
          : "block rounded-lg bg-muted/40 px-4 py-3 transition-colors hover:bg-muted/70"
      }
    >
      <div className="text-3xl font-semibold tabular-nums leading-none">
        {carregando ? "…" : numero}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{rotulo}</div>
    </Link>
  );
}

export function HojeOperacional() {
  const { activeOrg, user } = useAuth();
  const counts = useConversationCounts(activeOrg?.orgId ?? null);
  const radar = useAtRiskLeads();
  const hoje = useProximasAcoes("hoje", { mine: true });
  const atrasados = useProximasAcoes("atrasados", { mine: true });
  const semPasso = useProximasAcoes("sem_passo");
  const manager = activeOrg?.role === "manager" || activeOrg?.role === "admin";
  const equipeHoje = useProximasAcoes("hoje");
  const equipeAtrasados = useProximasAcoes("atrasados");

  const quentesSemAcao = useMemo(
    () => (semPasso.data ?? []).filter((a) => a.temperatura === "quente").length,
    [semPasso.data],
  );

  const minhas = counts.data?.mine ?? 0;
  const lista = (hoje.data ?? []).slice(0, 6);

  return (
    <section className="space-y-6" data-testid="hoje-operacional-legado">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Hoje</h2>
        <p className="text-[13px] text-muted-foreground">
          Quem atender, o que fazer e quando — sem lembrar de cabeça.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Bloco
          href="/app/agenda?visao=hoje"
          numero={hoje.data?.length ?? 0}
          rotulo="retornos hoje"
          carregando={hoje.isLoading}
        />
        <Bloco
          href="/app/agenda?visao=atrasados"
          numero={atrasados.data?.length ?? 0}
          rotulo="atrasados"
          carregando={atrasados.isLoading}
          destaque={(atrasados.data?.length ?? 0) > 0}
        />
        <Bloco
          href="/app/kanban?sem_acao=1&quentes=1"
          numero={quentesSemAcao}
          rotulo="quentes sem próxima ação"
          carregando={semPasso.isLoading}
        />
        <Bloco
          href="/app/inbox?filter=mine"
          numero={minhas}
          rotulo="conversas aguardando você"
          carregando={counts.isLoading}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs text-muted-foreground">Sua lista</h3>
          <Link href="/app/agenda" className="text-xs text-muted-foreground hover:underline">
            Ver agenda
          </Link>
        </div>
        <ListaDeAcoes acoes={lista} vazia="Nenhuma ação para hoje." />
      </div>

      {manager ? (
        <div className="space-y-2" data-testid="hoje-supervisor">
          <h3 className="text-xs text-muted-foreground">Equipe</h3>
          <p className="text-sm text-muted-foreground">
            {equipeHoje.data?.length ?? 0} ações hoje · {equipeAtrasados.data?.length ?? 0} atrasadas
            · {semPasso.data?.length ?? 0} sem próxima ação
            {user.id ? ` · as suas: ${hoje.data?.length ?? 0}` : ""}
          </p>
        </div>
      ) : null}

      {radar.data?.total ? (
        <p className="text-xs text-muted-foreground">
          Radar: {radar.data.total} negócio(s) em risco — risco comercial, não segunda lista de
          tarefas.{" "}
          <Link href="/app/radar" className="underline">
            Abrir radar
          </Link>
        </p>
      ) : null}
    </section>
  );
}
