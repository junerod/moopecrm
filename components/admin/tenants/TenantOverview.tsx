"use client";

import { Badge } from "@/components/ui/badge";
import { Warning } from "@/lib/ui/icons";
import type { TenantCounts, TenantOrganization } from "@/hooks/useTenantDetail";
import { formatarDataHora, nomeDoMesCorrente } from "./datas";

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </dt>
      <dd className="text-sm font-medium leading-snug">{valor}</dd>
    </div>
  );
}

function StatCard({
  label,
  value,
  warning,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  const alerta = Boolean(warning && value > 0);
  return (
    <div
      className={[
        "rounded-2xl border p-4",
        alerta
          ? "border-amber-500/40 bg-amber-950/20"
          : "border-border/80 bg-card",
      ].join(" ")}
    >
      <p className="text-2xl font-semibold tabular-nums tracking-tight">
        {value.toLocaleString("pt-BR")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      {alerta && (
        <Warning
          size={14}
          weight="fill"
          className="mt-2 text-amber-500"
          aria-label="Atenção"
        />
      )}
    </div>
  );
}

function planoDoTenant(settings: TenantOrganization["settings"]): string | null {
  const bruto = (settings as { plan?: unknown } | null)?.plan;
  if (typeof bruto !== "string") return null;
  const plano = bruto.trim();
  if (!plano || plano === "—") return null;
  return plano;
}

interface TenantOverviewProps {
  organization: TenantOrganization;
  counts: TenantCounts;
}

export function TenantOverview({ organization, counts }: TenantOverviewProps) {
  const plano = planoDoTenant(organization.settings);
  const mes = nomeDoMesCorrente();
  const whatsapp =
    counts.whatsapp_sessions_count === 0
      ? "Nenhuma sessão"
      : counts.whatsapp_sessions_working === counts.whatsapp_sessions_count
        ? `${counts.whatsapp_sessions_working} conectada${counts.whatsapp_sessions_working === 1 ? "" : "s"}`
        : `${counts.whatsapp_sessions_working} de ${counts.whatsapp_sessions_count} conectada${counts.whatsapp_sessions_count === 1 ? "" : "s"}`;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border/80 bg-card p-6">
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Sobre o tenant
        </h2>
        <dl className="grid gap-5 sm:grid-cols-2">
          <Campo
            rotulo="Razão social"
            valor={organization.legal_name ?? organization.display_name}
          />
          {organization.cnpj ? (
            <Campo rotulo="CNPJ" valor={organization.cnpj} />
          ) : null}
          {plano ? (
            <Campo
              rotulo="Plano"
              valor={
                <Badge variant="neutral" className="capitalize">
                  {plano}
                </Badge>
              }
            />
          ) : null}
          <Campo
            rotulo="Entrou em"
            valor={formatarDataHora(organization.created_at)}
          />
          <Campo
            rotulo="Onboarding concluído"
            valor={formatarDataHora(organization.onboarded_at)}
          />
          {organization.suspended_at ? (
            <Campo
              rotulo="Suspenso em"
              valor={formatarDataHora(organization.suspended_at)}
            />
          ) : null}
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Volumes
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Usuários" value={counts.user_count} />
          <StatCard label="Conversas" value={counts.conversations_count} />
          <StatCard label="Mensagens" value={counts.messages_count} />
          <StatCard label="Leads" value={counts.leads_count} />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-border/80 bg-card p-6">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            WhatsApp
          </h2>
          <p className="text-2xl font-semibold tracking-tight">{whatsapp}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sessões do canal neste tenant
          </p>
        </section>

        <section className="rounded-2xl border border-border/80 bg-card p-6">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Compliance e IA
          </h2>
          <dl className="grid gap-5">
            <Campo
              rotulo="Solicitações LGPD em aberto"
              valor={
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={
                      counts.lgpd_requests_pending > 0
                        ? "font-semibold text-amber-500"
                        : undefined
                    }
                  >
                    {counts.lgpd_requests_pending}
                  </span>
                  {counts.lgpd_requests_pending > 0 && (
                    <Warning
                      size={14}
                      weight="fill"
                      className="text-amber-500"
                      aria-label="Pendências LGPD"
                    />
                  )}
                </span>
              }
            />
            <Campo
              rotulo={`Invocações de IA em ${mes}`}
              valor={counts.ai_invocations_do_mes.toLocaleString("pt-BR")}
            />
          </dl>
        </section>
      </div>
    </div>
  );
}
