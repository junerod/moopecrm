"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  uploadMidiaCampanha,
  useAtualizarCampanha,
  useCriarCampanha,
  useEstimativaSegmento,
  useIaRascunho,
  useIniciarCampanha,
  useModelosCampanha,
  useOpcoesCampanha,
} from "@/hooks/campanhas/useCampanhas";
import {
  CARDS_DE_OBJETIVO,
  modeloCombinaComObjetivo,
  rascunhoDoObjetivo,
  rotuloDoObjetivo,
} from "@/lib/campanhas/objetivo";
import { ApiError } from "@/lib/api/types";
import { previewDaCampanha } from "@/lib/campanhas/preview";
import { LIMITE_CONFIRMACAO_LOTE, segmentoVazio } from "@/lib/campanhas/tipos";
import type {
  AnexoDaCampanha,
  ObjetivoDaCampanha,
  SegmentoDaCampanha,
  SelecaoDeCanais,
  SettingsDaCampanha,
} from "@/lib/campanhas/tipos";
import { ROTULO_DA_TEMPERATURA, ROTULO_DO_PAPEL } from "@/lib/crm/papel-e-temperatura";
import { PainelDeAjuda } from "@/components/ajuda/PainelDeAjuda";
import { AppCard } from "@/components/ds/AppCard";

import { AjudaCampo } from "./ajuda-campo";
import { IndicadorDePassos } from "./indicador-passos";
import { PreviewMensagem } from "./preview-mensagem";

const PASSOS = ["Objetivo", "Público", "Conteúdo", "Canal", "Quando", "Revisar"] as const;

const AJUDAS = {
  tag: "Etiqueta que você já colou no contato — vip, locadora, inadimplente. Só listamos o que já existe na base.",
  papel: "Quem é a pessoa. Lead ainda está em venda. Cliente já comprou ou alugou. Equipe é gente de dentro.",
  origem: "De onde o contato entrou: WhatsApp, indicação, site, Gestão.",
  owner: "Quem do time é dono do negócio aberto no funil. Não é o criador da campanha.",
  funil: "Qual esteira comercial — locação, vendas, pós-venda.",
  etapa: "Em que fase do funil o negócio está agora.",
  temperatura: "Quão perto está de fechar. Você marca isso no Kanban: frio, morno ou quente.",
};

type PresetPublico = "nenhum" | "clientes" | "leads" | "quente" | "morno" | "frio" | "escolher" | "base";

export function NovaCampanhaClient() {
  const router = useRouter();
  const criar = useCriarCampanha();
  const atualizar = useAtualizarCampanha();
  const iniciar = useIniciarCampanha();
  const opcoes = useOpcoesCampanha();
  const modelos = useModelosCampanha();
  const ia = useIaRascunho();

  const [passo, setPasso] = useState(0);
  const [objetivo, setObjetivo] = useState<ObjetivoDaCampanha>("personalizada");
  const [nome, setNome] = useState("Campanha comercial");
  const [preset, setPreset] = useState<PresetPublico>("nenhum");
  const [tag, setTag] = useState("");
  const [papel, setPapel] = useState("");
  const [origem, setOrigem] = useState("");
  const [owner, setOwner] = useState("");
  const [pipeline, setPipeline] = useState("");
  const [stage, setStage] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [body, setBody] = useState("");
  const [versoesIa, setVersoesIa] = useState<string[]>([]);
  const [canais, setCanais] = useState<SelecaoDeCanais>("whatsapp");
  const [sessionId, setSessionId] = useState("");
  const [templateOficial, setTemplateOficial] = useState("");
  const [quando, setQuando] = useState<"agora" | "agendar">("agora");
  const [agendado, setAgendado] = useState("");
  const [anexos, setAnexos] = useState<AnexoDaCampanha[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [confirmBase, setConfirmBase] = useState(false);
  const [confirmLarge, setConfirmLarge] = useState(false);
  const [previewAba, setPreviewAba] = useState<"whatsapp" | "email">("whatsapp");
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [subindoMidia, setSubindoMidia] = useState(false);

  const segmento: SegmentoDaCampanha = useMemo(() => {
    const s: SegmentoDaCampanha = {};
    if (tag.trim()) s.tags = [tag.trim()];
    if (papel.trim()) s.papel = papel.trim();
    if (origem.trim()) s.origem = origem.trim();
    if (owner.trim()) s.owner_user_id = owner.trim();
    if (pipeline.trim()) s.pipeline_id = pipeline.trim();
    if (stage.trim()) s.stage_id = stage.trim();
    if (temperatura.trim()) s.temperatura = temperatura.trim() as "frio" | "morno" | "quente";
    if (escolhidos.length) s.contact_ids = escolhidos;
    return s;
  }, [tag, papel, origem, owner, pipeline, stage, temperatura, escolhidos]);

  const estimativa = useEstimativaSegmento(segmento, passo >= 1, canais, busca);
  const preview = previewDaCampanha({
    template: body,
    valores: { nome: "Maria", telefone: "+5511999990000", email: "maria@exemplo.com" },
  });

  const settings = (): SettingsDaCampanha => ({
    objective: objetivo,
    channels: canais,
    attachments: anexos.map((a) => ({
      storage_path: a.storage_path,
      mime: a.mime,
      size_bytes: a.size_bytes,
      filename: a.filename,
      kind: a.kind,
    })),
    confirm_all_base: confirmBase,
    confirm_large: confirmLarge,
    cta_url: ctaUrl || null,
    cta_label: ctaLabel || null,
    timezone: "America/Sao_Paulo",
  });

  const payload = () => ({
    name: nome.trim() || "Campanha comercial",
    body_text: body,
    segment: segmento,
    channel_session_id: sessionId || null,
    template_id: templateOficial || null,
    scheduled_at: quando === "agendar" && agendado ? new Date(agendado).toISOString() : null,
    settings: settings(),
  });

  async function persistir(): Promise<string> {
    const corpo = payload();
    if (rascunhoId) {
      await atualizar.mutateAsync({ id: rascunhoId, ...corpo });
      setSalvoEm(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      return rascunhoId;
    }
    const c = await criar.mutateAsync(corpo);
    setRascunhoId(c.id);
    setSalvoEm(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    return c.id;
  }

  async function salvarRascunho() {
    try {
      setErro(null);
      await persistir();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui salvar o rascunho.");
    }
  }

  async function disparar() {
    setErro(null);
    if (!body.trim()) {
      setErro("Escreva a mensagem que o contato vai receber.");
      return;
    }
    if ((estimativa.data?.elegiveis ?? 0) < 1) {
      setErro("Ninguém neste recorte pode receber. Volte e escolha outro público.");
      return;
    }
    if (estimativa.data?.atinge_base_inteira && !confirmBase) {
      setErro("Marque a confirmação: esta campanha atinge toda a sua base.");
      return;
    }
    if ((estimativa.data?.elegiveis ?? 0) > LIMITE_CONFIRMACAO_LOTE && !confirmLarge) {
      setErro(`Marque a confirmação para enviar a ${estimativa.data?.elegiveis} contatos.`);
      return;
    }
    if (!preview.ok) {
      setErro("A mensagem ainda tem variável sem valor. Ajuste o texto antes de enviar.");
      return;
    }
    try {
      const id = await persistir();
      await iniciar.mutateAsync(id);
      router.push(`/app/campanhas/${id}`);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "O envio não saiu. Tente de novo ou salve o rascunho.");
    }
  }

  function aplicarPreset(p: PresetPublico) {
    setPreset(p);
    setEscolhidos([]);
    if (p === "clientes") {
      setPapel("cliente");
      setTemperatura("");
    } else if (p === "leads") {
      setPapel("lead");
      setTemperatura("");
    } else if (p === "quente" || p === "morno" || p === "frio") {
      setPapel("lead");
      setTemperatura(p);
    } else if (p === "escolher" || p === "base" || p === "nenhum") {
      setPapel("");
      setTemperatura("");
    }
  }

  function toggleContato(id: string) {
    setPreset("escolher");
    setEscolhidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const funil = (opcoes.data?.funis ?? []).find((f) => f.id === pipeline);
  const alcance = estimativa.data?.alcance;
  const lista = estimativa.data?.preview ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4" data-testid="campanha-wizard">
      <PainelDeAjuda
        testid="campanha-ajuda-wizard"
        titulo="Seis passos, nesta ordem"
        texto="Objetivo, público, texto, por onde envia, quando, e a revisão. No WhatsApp do celular a campanha só chega em quem já conversou nesse número."
        href="/app/manual#campanhas"
        rotuloDoLink="Ler o guia completo de campanhas"
      />
      <IndicadorDePassos passos={PASSOS} atual={passo} onIr={setPasso} />

      {passo === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="campanha-passo-objetivo">
          <p className="sm:col-span-2 text-sm font-medium">O que esta campanha precisa resolver?</p>
          {CARDS_DE_OBJETIVO.map((c) => (
            <button
              key={c.id}
              type="button"
              data-testid={`campanha-objetivo-${c.id}`}
              onClick={() => {
                setObjetivo(c.id);
                setNome(c.titulo);
                setBody(c.rascunho);
                setVersoesIa([]);
              }}
              className={`rounded-[16px] p-4 text-left ring-1 transition-shadow ${
                objetivo === c.id
                  ? "bg-[var(--color-surface)] ring-[var(--color-accent)] shadow-[var(--shadow-md)]"
                  : "bg-[var(--color-surface)] ring-[var(--color-border)]"
              }`}
            >
              <p className="text-sm font-semibold">{c.titulo}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{c.descricao}</p>
            </button>
          ))}
        </div>
      ) : null}

      {passo === 1 ? (
        <div className="space-y-5" data-testid="campanha-passo-segmento">
          <div>
            <p className="text-sm font-medium">Para quem é esta campanha?</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Campanha boa é dirigida. Escolha um público — não dispare para a base inteira sem querer.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["clientes", "Só clientes", "Quem já comprou ou alugou"],
                  ["leads", "Só leads", "Ainda em conversa de venda"],
                  ["quente", "Leads quentes", "Perto de fechar"],
                  ["morno", "Leads mornos", "Interessados, sem pressa"],
                  ["frio", "Leads frios", "Esfriaram — reativar"],
                  ["escolher", "Escolher pessoas", "Você marca na lista"],
                  ["base", "Toda a base", "Exige confirmação depois"],
                ] as const
              ).map(([id, titulo, dica]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => aplicarPreset(id)}
                  className={`rounded-[14px] p-3 text-left ring-1 ${
                    preset === id
                      ? "bg-[var(--color-surface)] ring-[var(--color-accent)]"
                      : "bg-[var(--color-surface)] ring-[var(--color-border)]"
                  }`}
                >
                  <p className="text-sm font-semibold">{titulo}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{dica}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <CampoFiltro
              id="camp-tag"
              label="Tag"
              ajuda={AJUDAS.tag}
              value={tag}
              onChange={setTag}
              opcoes={opcoes.data?.tags}
            />
            <CampoFiltro
              id="camp-papel"
              label="Tipo de contato"
              ajuda={AJUDAS.papel}
              value={papel}
              onChange={setPapel}
              opcoes={["lead", "cliente", "equipe"]}
              rotulos={{ ...ROTULO_DO_PAPEL }}
            />
            <CampoFiltro
              id="camp-temp"
              label="Qualificação"
              ajuda={AJUDAS.temperatura}
              value={temperatura}
              onChange={setTemperatura}
              opcoes={["frio", "morno", "quente"]}
              rotulos={{ ...ROTULO_DA_TEMPERATURA }}
            />
            <CampoFiltro
              id="camp-origem"
              label="Origem"
              ajuda={AJUDAS.origem}
              value={origem}
              onChange={setOrigem}
              opcoes={opcoes.data?.origens}
            />
            <CampoFiltro
              id="camp-owner"
              label="Responsável"
              ajuda={AJUDAS.owner}
              value={owner}
              onChange={setOwner}
              opcoes={(opcoes.data?.responsaveis ?? []).map((r) => r.id)}
              rotulos={Object.fromEntries(
                (opcoes.data?.responsaveis ?? []).map((r) => [r.id, r.nome ?? r.role]),
              )}
            />
            <CampoFiltro
              id="camp-funil"
              label="Funil"
              ajuda={AJUDAS.funil}
              value={pipeline}
              onChange={(v) => {
                setPipeline(v);
                setStage("");
              }}
              opcoes={(opcoes.data?.funis ?? []).map((f) => f.id)}
              rotulos={Object.fromEntries((opcoes.data?.funis ?? []).map((f) => [f.id, f.name]))}
            />
            <CampoFiltro
              id="camp-etapa"
              label="Etapa do funil"
              ajuda={AJUDAS.etapa}
              value={stage}
              onChange={setStage}
              opcoes={(funil?.crm_stages ?? []).map((s) => s.id)}
              rotulos={Object.fromEntries((funil?.crm_stages ?? []).map((s) => [s.id, s.name]))}
            />
          </div>

          <AppCard>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium" data-testid="campanha-estimativa">
                  {estimativa.data?.rotulo ?? "Contando o público…"}
                </p>
                {alcance ? (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {alcance.whatsapp} com WhatsApp · {alcance.email} com e-mail · {alcance.ambos} nos
                    dois · {alcance.nenhum} sem canal
                  </p>
                ) : null}
                {estimativa.data ? (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Fora do envio: {estimativa.data.exclusoes.bloqueados} bloqueados ·{" "}
                    {estimativa.data.exclusoes.opt_out} pediram para parar
                  </p>
                ) : null}
              </div>
              <Button type="button" variant="outline" size="sm" data-testid="campanha-ver-contatos">
                Ver e escolher
              </Button>
            </div>
            {estimativa.data?.atinge_base_inteira || (preset === "base" && segmentoVazio(segmento)) ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" data-testid="campanha-alerta-base">
                Esta campanha atingirá toda a sua base.
              </p>
            ) : null}
            {escolhidos.length > 0 ? (
              <p className="mt-2 text-xs font-medium text-[var(--color-text)]">
                {escolhidos.length} pessoa(s) marcada(s) na lista — só elas entram.
              </p>
            ) : null}
            <div className="mt-3">
              <Input
                placeholder="Buscar por nome, telefone ou e-mail"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <ul
              className="mt-3 max-h-72 divide-y divide-[var(--color-border)] overflow-auto rounded-lg ring-1 ring-[var(--color-border)]"
              data-testid="campanha-preview-contatos"
            >
              {lista.length === 0 ? (
                <li className="p-4 text-sm text-[var(--color-text-muted)]">
                  Ninguém neste recorte. Afrouxe o filtro ou escolha outro público.
                </li>
              ) : (
                lista.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-[var(--color-bg)]">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={escolhidos.includes(c.id)}
                        onChange={() => toggleContato(c.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.nome}</span>
                        <span className="block truncate text-xs text-[var(--color-text-muted)]">
                          {c.telefone ?? "sem WhatsApp"}
                          {c.email ? ` · ${c.email}` : " · sem e-mail"}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1 text-[10px]">
                        {c.papel ? (
                          <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5">
                            {ROTULO_DO_PAPEL[c.papel as keyof typeof ROTULO_DO_PAPEL] ?? c.papel}
                          </span>
                        ) : null}
                        <span className="text-[var(--color-text-muted)]">
                          {c.tem_whatsapp ? "WhatsApp" : ""}
                          {c.tem_whatsapp && c.tem_email ? " · " : ""}
                          {c.tem_email ? "E-mail" : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
            {escolhidos.length > 0 ? (
              <button
                type="button"
                className="mt-2 text-xs underline"
                onClick={() => {
                  setEscolhidos([]);
                  setPreset("nenhum");
                }}
              >
                Limpar escolha manual
              </button>
            ) : null}
          </AppCard>
        </div>
      ) : null}

      {passo === 2 ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" data-testid="campanha-passo-mensagem">
          <div className="space-y-4">
            <div>
              <Label htmlFor="camp-nome">Nome interno da campanha</Label>
              <Input id="camp-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                Só a equipe vê. O contato recebe a mensagem abaixo.
              </p>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Modelos prontos para este objetivo</p>
              <p className="mb-2 text-xs text-[var(--color-text-muted)]">
                Cada card tem um texto diferente. Clique para usar.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setBody(rascunhoDoObjetivo(objetivo))}>
                  Texto do objetivo
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setBody("")}>
                  Em branco
                </Button>
              </div>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2" data-testid="campanha-modelos">
                {(modelos.data ?? [])
                  .slice()
                  .sort((a, b) => {
                    const sa = modeloCombinaComObjetivo(a.title, objetivo) ? 0 : 1;
                    const sb = modeloCombinaComObjetivo(b.title, objetivo) ? 0 : 1;
                    return sa - sb;
                  })
                  .map((m) => {
                    const combina = modeloCombinaComObjetivo(m.title, objetivo);
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          className={`h-full w-full rounded-[12px] p-3 text-left text-sm ring-1 ${
                            combina
                              ? "ring-[var(--color-accent)]"
                              : "ring-[var(--color-border)]"
                          }`}
                          data-testid={`campanha-usar-modelo-${m.id}`}
                          onClick={() => {
                            setNome(m.title);
                            setBody(m.body);
                          }}
                        >
                          <span className="font-medium">{m.title}</span>
                          <span className="mt-1 line-clamp-3 block text-xs text-[var(--color-text-muted)]">
                            {m.body}
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
              {(modelos.data ?? []).length === 0 ? (
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  Nenhum modelo na base ainda. O texto do objetivo já veio preenchido acima.
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="camp-body">Mensagem que o contato lê</Label>
              <textarea
                id="camp-body"
                className="min-h-36 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Personalize com {`{{nome}}`}, {`{{telefone}}`} ou {`{{email}}`} — cada um vê o próprio dado.
              </p>
            </div>
            <div className="rounded-[14px] bg-[var(--color-bg)] p-3">
              <p className="text-sm font-medium">Ajustar o rascunho</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                Só reescreve o texto desta tela. Não escolhe destinatário e não envia para ninguém.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["melhorar", "Deixar mais claro"],
                    ["encurtar", "Versão curta"],
                    ["comercial", "Tom de venda"],
                    ["profissional", "Tom formal"],
                    ["tres_versoes", "Sugerir 3 versões"],
                  ] as const
                ).map(([acao, rotulo]) => (
                  <Button
                    key={acao}
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid={`campanha-ia-${acao}`}
                    disabled={ia.isPending || !body.trim()}
                    onClick={() =>
                      void ia.mutateAsync({ texto: body, acao }).then((r) => {
                        setVersoesIa(r.versoes);
                        if (r.versoes[0]) setBody(r.versoes[0]);
                      })
                    }
                  >
                    {rotulo}
                  </Button>
                ))}
              </div>
              {versoesIa.length > 1 ? (
                <ul className="mt-2 space-y-1">
                  {versoesIa.map((v, i) => (
                    <li key={`${i}-${v.slice(0, 12)}`}>
                      <button
                        type="button"
                        className="w-full rounded-lg px-2 py-1.5 text-left text-xs ring-1 ring-[var(--color-border)]"
                        onClick={() => setBody(v)}
                      >
                        Versão {i + 1}: {v}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div>
              <Label htmlFor="camp-midia">Mídia que viaja com a mensagem</Label>
              <Input
                id="camp-midia"
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
                data-testid="campanha-anexar-midia"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const local = URL.createObjectURL(file);
                  setSubindoMidia(true);
                  void uploadMidiaCampanha(file, rascunhoId ?? "draft")
                    .then((a) => {
                      setAnexos((prev) => [...prev, a]);
                      setPreviews((prev) => ({
                        ...prev,
                        [a.storage_path]: a.preview_url || local,
                      }));
                    })
                    .finally(() => setSubindoMidia(false));
                }}
              />
              {subindoMidia ? (
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">Enviando arquivo…</p>
              ) : null}
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {anexos.map((a) => {
                  const url = previews[a.storage_path];
                  return (
                    <li
                      key={a.storage_path}
                      className="overflow-hidden rounded-[12px] ring-1 ring-[var(--color-border)]"
                      data-testid="campanha-midia-card"
                    >
                      {url && a.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={a.filename} className="h-28 w-full object-cover" />
                      ) : (
                        <div className="flex h-20 items-center justify-center bg-[var(--color-bg)] text-xs">
                          {a.kind === "video" ? "Vídeo" : "PDF"} · {a.filename}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                        <span className="truncate">{a.filename}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setAnexos((prev) => prev.filter((x) => x.storage_path !== a.storage_path))
                          }
                        >
                          Remover
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <Label htmlFor="camp-cta-label">Botão (opcional)</Label>
                <Input
                  id="camp-cta-label"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="Ver oferta"
                />
              </div>
              <div>
                <Label htmlFor="camp-cta-url">Link do botão</Label>
                <Input
                  id="camp-cta-url"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="https://"
                />
              </div>
            </div>
          </div>
          <PreviewMensagem
            texto={preview.texto}
            aba={previewAba}
            onAba={setPreviewAba}
            ok={preview.ok}
            anexos={anexos}
            previews={previews}
            ctaLabel={ctaLabel}
          />
        </div>
      ) : null}

      {passo === 3 ? (
        <div className="space-y-4" data-testid="campanha-passo-canal">
          <div>
            <p className="text-sm font-medium">Por onde esta mensagem deve chegar?</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              E-mail é auxiliar: útil para quem tem caixa, mas a maioria da base costuma estar no WhatsApp.
              Quem não tem o canal escolhido fica de fora — e você vê o número antes de enviar.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                [
                  "whatsapp",
                  "WhatsApp",
                  `${alcance?.whatsapp ?? "—"} pessoas com número`,
                  "Canal principal. Chega no celular.",
                ],
                [
                  "email",
                  "Só e-mail",
                  `${alcance?.email ?? "—"} pessoas com e-mail`,
                  "Auxiliar. Só entra quem tem e-mail cadastrado.",
                ],
                [
                  "ambos",
                  "WhatsApp + e-mail",
                  `${alcance?.ambos ?? "—"} nos dois · o resto no que tiver`,
                  "Quem tem os dois recebe nos dois. Quem tem um, só naquele.",
                ],
              ] as const
            ).map(([id, titulo, conta, dica]) => (
              <button
                key={id}
                type="button"
                data-testid={`campanha-canal-${id}`}
                onClick={() => setCanais(id)}
                className={`rounded-[16px] p-4 text-left ring-1 ${
                  canais === id
                    ? "ring-[var(--color-accent)] bg-[var(--color-surface)]"
                    : "ring-[var(--color-border)] bg-[var(--color-surface)]"
                }`}
              >
                <p className="font-semibold">{titulo}</p>
                <p className="mt-1 text-sm tabular-nums">{conta}</p>
                <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">{dica}</p>
              </button>
            ))}
          </div>
          <p className="text-sm">
            WhatsApp: {opcoes.data?.whatsapp.rotulo ?? "…"} · E-mail: {opcoes.data?.email.rotulo ?? "…"}
          </p>
          <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
            No número do celular a campanha só chega em quem já tem conversa
            aberta nesse WhatsApp. Quem nunca falou precisa de Nova conversa na
            caixa. Quem já conversou — mesmo que o aparelho tenha sido
            reconectado — entra na fila.
          </p>
          {(canais === "whatsapp" || canais === "ambos") && (opcoes.data?.sessoes.length ?? 0) > 0 ? (
            <div>
              <Label htmlFor="camp-sessao">Número que envia</Label>
              <select
                id="camp-sessao"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              >
                <option value="">Selecionar</option>
                {(opcoes.data?.sessoes ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.rotulo}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {(opcoes.data?.templates_oficiais.length ?? 0) > 0 ? (
            <div>
              <Label htmlFor="camp-tpl">Modelo WhatsApp oficial</Label>
              <select
                id="camp-tpl"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={templateOficial}
                onChange={(e) => setTemplateOficial(e.target.value)}
              >
                <option value="">Nenhum</option>
                {(opcoes.data?.templates_oficiais ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.language})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      {passo === 4 ? (
        <div className="space-y-3" data-testid="campanha-passo-quando">
          <label className="flex items-start gap-3 rounded-[14px] p-4 ring-1 ring-[var(--color-border)]">
            <input type="radio" checked={quando === "agora"} onChange={() => setQuando("agora")} />
            <span>
              <span className="block text-sm font-medium">Enviar agora</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Entra na fila assim que você confirmar.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-[14px] p-4 ring-1 ring-[var(--color-border)]">
            <input
              type="radio"
              data-testid="campanha-agendar"
              checked={quando === "agendar"}
              onChange={() => setQuando("agendar")}
            />
            <span>
              <span className="block text-sm font-medium">Agendar</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Escolha dia e hora no relógio da empresa.
              </span>
            </span>
          </label>
          {quando === "agendar" ? (
            <Input
              type="datetime-local"
              data-testid="campanha-agenda-em"
              value={agendado}
              onChange={(e) => setAgendado(e.target.value)}
            />
          ) : null}
          {quando === "agendar" && agendado ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {new Date(agendado).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </p>
          ) : null}
        </div>
      ) : null}

      {passo === 5 ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" data-testid="campanha-passo-revisar">
          <div className="space-y-3">
            <AppCard>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Você está enviando</p>
              <p className="mt-1 text-lg font-semibold">{nome}</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{rotuloDoObjetivo(objetivo)}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <Item rotulo="Público" valor={estimativa.data?.rotulo ?? "—"} />
                <Item
                  rotulo="Canal"
                  valor={
                    canais === "ambos" ? "WhatsApp + e-mail" : canais === "email" ? "E-mail" : "WhatsApp"
                  }
                />
                <Item rotulo="Quando" valor={quando === "agora" ? "Agora" : agendado || "—"} />
                <Item
                  rotulo="Mídia"
                  valor={anexos.length ? anexos.map((a) => a.filename).join(", ") : "Só texto"}
                />
              </dl>
              <p className="mt-4 whitespace-pre-wrap rounded-xl bg-[var(--color-bg)] p-3 text-sm leading-relaxed">
                {preview.texto}
              </p>
            </AppCard>
            {estimativa.data?.atinge_base_inteira ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid="campanha-confirma-base"
                  checked={confirmBase}
                  onChange={(e) => setConfirmBase(e.target.checked)}
                />
                Confirmo enviar para toda a base
              </label>
            ) : null}
            {(estimativa.data?.elegiveis ?? 0) > LIMITE_CONFIRMACAO_LOTE ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid="campanha-confirma-lote"
                  checked={confirmLarge}
                  onChange={(e) => setConfirmLarge(e.target.checked)}
                />
                Confirmo enviar para {estimativa.data?.elegiveis} contatos
              </label>
            ) : null}
          </div>
          <PreviewMensagem
            texto={preview.texto}
            aba={previewAba}
            onAba={setPreviewAba}
            ok={preview.ok}
            anexos={anexos}
            previews={previews}
            ctaLabel={ctaLabel}
          />
        </div>
      ) : null}

      {erro ? (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-100" role="alert">
          {erro}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {passo === 0 ? (
          <Button variant="outline" asChild>
            <Link href="/app/campanhas">Cancelar</Link>
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setPasso(passo - 1)}>
            Voltar
          </Button>
        )}
        {passo >= 2 ? (
          <Button
            variant="outline"
            data-testid="campanha-salvar-rascunho"
            disabled={criar.isPending}
            onClick={() => void salvarRascunho()}
          >
            Salvar rascunho
          </Button>
        ) : null}
        {salvoEm ? (
          <span className="text-xs text-[var(--color-text-muted)]">Rascunho salvo às {salvoEm}</span>
        ) : null}
        {passo < 5 ? (
          <Button data-testid="campanha-proximo" onClick={() => setPasso(passo + 1)}>
            Continuar
          </Button>
        ) : (
          <Button
            data-testid="campanha-enviar"
            disabled={criar.isPending || atualizar.isPending || iniciar.isPending}
            onClick={() => void disparar()}
          >
            {criar.isPending || atualizar.isPending || iniciar.isPending
              ? "Enviando…"
              : quando === "agendar"
                ? "Agendar campanha"
                : "Enviar campanha"}
          </Button>
        )}
      </div>
    </div>
  );
}

function CampoFiltro({
  id,
  label,
  ajuda,
  value,
  onChange,
  opcoes,
  rotulos,
}: {
  id: string;
  label: string;
  ajuda: string;
  value: string;
  onChange: (v: string) => void;
  opcoes?: string[];
  rotulos?: Record<string, string>;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <Label htmlFor={id}>{label}</Label>
        <AjudaCampo titulo={label} texto={ajuda} />
      </div>
      {id === "camp-tag" ? (
        <>
          <Input
            id="camp-tag"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Escolha ou digite"
            list="camp-tag-opts"
          />
          {opcoes && opcoes.length > 0 ? (
            <datalist id="camp-tag-opts">
              {opcoes.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          ) : null}
        </>
      ) : (
        <select
          id={id}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Qualquer</option>
          {(opcoes ?? []).map((o) => (
            <option key={o} value={o}>
              {rotulos?.[o] ?? o}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-text-muted)]">{rotulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
