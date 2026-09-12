"use client";
import { useState } from "react";

import { useAttendantMetrics, type AttendantMetric } from "@/hooks/metrics/useAttendantMetrics";
import { useSupervisao } from "@/hooks/supervisao/useSupervisao";
import { AtritoPanel } from "./AtritoPanel";
import { useTeamMembers } from "@/hooks/team/useTeamMembers";
import type { PeriodoPronto } from "@/lib/supervisao/periodo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${m}min` : `${m}min ${rest}s`;
}

function attendantLabel(a: AttendantMetric): string {
  return a.name ?? a.email ?? `Atendente ${a.user_id.slice(0, 8)}`;
}

interface Props {
  canCompare: boolean;
  currentUserId: string;
}

export function MetricsClient({ canCompare, currentUserId }: Props) {
  const [owner, setOwner] = useState<string>(ALL);
  const [periodo, setPeriodo] = useState<PeriodoPronto>("30d");
  const selectedOwner = owner === ALL ? null : owner;
  const { data, isLoading, isError } = useAttendantMetrics(selectedOwner);
  const supervisao = useSupervisao(periodo, canCompare);
  // Opções do filtro: só manager+ (a rota /team é manager+). Agent nem vê o filtro.
  const team = useTeamMembers({ enabled: canCompare });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (isError || !data) return <p className="text-sm text-destructive">Erro ao carregar métricas.</p>;

  const metrics = data.data;
  const funnelTotal = metrics.funnel.reduce((acc, s) => acc + s.count, 0);
  const maxCount = Math.max(1, ...metrics.funnel.map((s) => s.count));

  return (
    <div className="flex flex-col gap-6">
      {canCompare ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2" data-testid="desempenho-periodo">
            {(["hoje", "7d", "30d"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`rounded-md border px-2 py-1 text-xs ${periodo === p ? "bg-primary text-primary-foreground" : "bg-background"}`}
                onClick={() => setPeriodo(p)}
              >
                {p === "hoje" ? "Hoje" : p === "7d" ? "7 dias" : "30 dias"}
              </button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">Atendente</span>
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Todos os atendentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os atendentes</SelectItem>
              {(team.data?.data ?? [])
                .filter((m) => m.role !== "viewer")
                .map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name ?? m.email ?? m.user_id.slice(0, 8)}
                    {m.user_id === currentUserId ? " (você)" : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Acima do funil e da performance de propósito: é o número do sistema
          inteiro, ao qual as métricas de área se subordinam (doutrina §3.6).
          Não filtra por atendente — atrito é propriedade do sistema, e quebrá-lo
          por pessoa convida a otimização local que degrada o todo. */}
      {canCompare && supervisao.data ? (
        <>
          <Card data-testid="desempenho-atendimento">
            <CardHeader>
              <CardTitle className="text-base">Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Kpi rotulo="Aguardando na fila" valor={supervisao.data.atendimento.fila} />
              <Kpi
                rotulo="Espera mais antiga"
                valor={formatDuration(supervisao.data.atendimento.espera_mais_antiga_s)}
              />
              <Kpi
                rotulo="1ª resposta média"
                valor={formatDuration(supervisao.data.atendimento.primeira_resposta_media_s)}
              />
              <Kpi rotulo="Conversas abertas" valor={supervisao.data.atendimento.conversas_abertas} />
            </CardContent>
          </Card>
          <Card data-testid="desempenho-comercial">
            <CardHeader>
              <CardTitle className="text-base">Comercial</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Kpi rotulo="Leads novos" valor={supervisao.data.comercial.leads_novos} />
              <Kpi rotulo="Oportunidades abertas" valor={supervisao.data.comercial.oportunidades_abertas} />
              <Kpi rotulo="Sem próxima ação" valor={supervisao.data.comercial.sem_proxima_acao} />
              <Kpi rotulo="Atrasadas" valor={supervisao.data.comercial.atrasadas} />
              <Kpi rotulo="Ganhos" valor={supervisao.data.comercial.ganhos} />
              <Kpi rotulo="Perdidos" valor={supervisao.data.comercial.perdidos} />
              <Kpi
                rotulo="Conversão"
                valor={
                  supervisao.data.comercial.conversao == null
                    ? "—"
                    : `${Math.round(supervisao.data.comercial.conversao * 100)}%`
                }
              />
            </CardContent>
          </Card>
          <Card data-testid="desempenho-campanhas">
            <CardHeader>
              <CardTitle className="text-base">Campanhas</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
              <Kpi rotulo="Executadas" valor={supervisao.data.campanhas.executadas} />
              <Kpi rotulo="Enviados" valor={supervisao.data.campanhas.enviados} />
              <Kpi rotulo="Respostas" valor={supervisao.data.campanhas.respostas} />
              <Kpi rotulo="Leads associados" valor={supervisao.data.campanhas.leads_associados} />
              <Kpi rotulo="Opt-outs" valor={supervisao.data.campanhas.opt_outs} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <AtritoPanel podeEditarRegua={canCompare} />

      <Card data-testid="funil-gerencial">
        <CardHeader>
          <CardTitle className="text-base">
            Funil {selectedOwner ? "do atendente" : ""} · {funnelTotal}{" "}
            {funnelTotal === 1 ? "aberto" : "abertos"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {metrics.funnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma etapa configurada.</p>
          ) : (
            metrics.funnel.map((s) => (
              <div key={s.stage_id} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm">{s.stage_name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${(s.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-sm tabular-nums">
                  {s.count}
                  {supervisao.data?.funil.find((f) => f.stage_id === s.stage_id)?.value_cents
                    ? ` · ${((supervisao.data.funil.find((f) => f.stage_id === s.stage_id)?.value_cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                    : ""}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card data-testid="desempenho-atendentes">
        <CardHeader>
          <CardTitle className="text-base">
            {canCompare ? "Performance por atendente" : "Sua performance"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.attendants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem atividade no período (ganhos/perdidos, conversas ou respostas).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atendente</TableHead>
                  <TableHead className="text-right">Ganhos</TableHead>
                  <TableHead className="text-right">Perdidos</TableHead>
                  <TableHead className="text-right">Conversas</TableHead>
                  <TableHead className="text-right">1ª resposta (média)</TableHead>
                  {canCompare ? (
                    <>
                      <TableHead className="text-right">Resolvidas</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Atrasadas</TableHead>
                    </>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.attendants.map((a) => (
                  <TableRow key={a.user_id}>
                    <TableCell className="font-medium">
                      {attendantLabel(a)}
                      {a.user_id === currentUserId ? (
                        <span className="text-muted-foreground"> (você)</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{a.won}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.lost}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.conversations_handled}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(a.avg_first_response_seconds)}
                    </TableCell>
                    {canCompare ? (
                      <>
                        <TableCell className="text-right tabular-nums">
                          {supervisao.data?.atendentes.find((x) => x.user_id === a.user_id)?.resolvidas ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {supervisao.data?.atendentes.find((x) => x.user_id === a.user_id)?.leads ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {supervisao.data?.atendentes.find((x) => x.user_id === a.user_id)?.atrasadas ?? "—"}
                        </TableCell>
                      </>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className="text-lg tabular-nums">{valor}</div>
    </div>
  );
}
