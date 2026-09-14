"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  uploadMidiaCampanha,
  useCriarCampanha,
  useEstimativaSegmento,
  useIaRascunho,
  useIniciarCampanha,
  useModelosCampanha,
  useOpcoesCampanha,
} from "@/hooks/campanhas/useCampanhas";
import { CARDS_DE_OBJETIVO } from "@/lib/campanhas/objetivo";
import { previewDaCampanha } from "@/lib/campanhas/preview";
import { LIMITE_CONFIRMACAO_LOTE, segmentoVazio } from "@/lib/campanhas/tipos";
import type {
  AnexoDaCampanha,
  ObjetivoDaCampanha,
  SegmentoDaCampanha,
  SelecaoDeCanais,
  SettingsDaCampanha,
} from "@/lib/campanhas/tipos";
import { AppCard } from "@/components/ds/AppCard";

const PASSOS = ["Objetivo", "Público", "Conteúdo", "Canal", "Quando", "Revisar"] as const;

export function NovaCampanhaClient() {
  const router = useRouter();
  const criar = useCriarCampanha();
  const iniciar = useIniciarCampanha();
  const opcoes = useOpcoesCampanha();
  const modelos = useModelosCampanha();
  const ia = useIaRascunho();

  const [passo, setPasso] = useState(0);
  const [objetivo, setObjetivo] = useState<ObjetivoDaCampanha>("personalizada");
  const [nome, setNome] = useState("Campanha comercial");
  const [tag, setTag] = useState("");
  const [papel, setPapel] = useState("");
  const [origem, setOrigem] = useState("");
  const [owner, setOwner] = useState("");
  const [pipeline, setPipeline] = useState("");
  const [stage, setStage] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [contactIds, setContactIds] = useState("");
  const [body, setBody] = useState("Olá {{nome}}, sua proposta está pronta.");
  const [canais, setCanais] = useState<SelecaoDeCanais>("whatsapp");
  const [sessionId, setSessionId] = useState("");
  const [templateOficial, setTemplateOficial] = useState("");
  const [quando, setQuando] = useState<"agora" | "agendar">("agora");
  const [agendado, setAgendado] = useState("");
  const [anexos, setAnexos] = useState<AnexoDaCampanha[]>([]);
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [confirmBase, setConfirmBase] = useState(false);
  const [confirmLarge, setConfirmLarge] = useState(false);
  const [verContatos, setVerContatos] = useState(false);
  const [previewAba, setPreviewAba] = useState<"whatsapp" | "email">("whatsapp");
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const segmento: SegmentoDaCampanha = useMemo(() => {
    const s: SegmentoDaCampanha = {};
    if (tag.trim()) s.tags = [tag.trim()];
    if (papel.trim()) s.papel = papel.trim();
    if (origem.trim()) s.origem = origem.trim();
    if (owner.trim()) s.owner_user_id = owner.trim();
    if (pipeline.trim()) s.pipeline_id = pipeline.trim();
    if (stage.trim()) s.stage_id = stage.trim();
    if (temperatura.trim()) s.temperatura = temperatura.trim() as "frio" | "morno" | "quente";
    const ids = contactIds
      .split(/[\s,;]+/)
      .map((x) => x.trim())
      .filter((x) => /^[0-9a-f-]{36}$/i.test(x));
    if (ids.length) s.contact_ids = ids;
    return s;
  }, [tag, papel, origem, owner, pipeline, stage, temperatura, contactIds]);

  const estimativa = useEstimativaSegmento(segmento, passo >= 1, canais);
  const preview = previewDaCampanha({
    template: body,
    valores: { nome: "Maria", telefone: "+5511999990000", email: "maria@exemplo.com" },
  });

  const settings = (): SettingsDaCampanha => ({
    objective: objetivo,
    channels: canais,
    attachments: anexos,
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

  async function salvarRascunho() {
    const c = await criar.mutateAsync(payload());
    setRascunhoId(c.id);
    return c.id;
  }

  async function disparar() {
    setErro(null);
    if (estimativa.data?.atinge_base_inteira && !confirmBase) {
      setErro("Confirme que esta campanha atingirá toda a sua base.");
      return;
    }
    if ((estimativa.data?.elegiveis ?? 0) > LIMITE_CONFIRMACAO_LOTE && !confirmLarge) {
      setErro(`Confirme o envio para ${estimativa.data?.elegiveis} contatos.`);
      return;
    }
    const id = rascunhoId ?? (await salvarRascunho());
    await iniciar.mutateAsync(id);
    router.push(`/app/campanhas/${id}`);
  }

  const funil = (opcoes.data?.funis ?? []).find((f) => f.id === pipeline);

  return (
    <div className="mx-auto w-full max-w-4xl" data-testid="campanha-wizard">
      <ol className="mb-4 flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
        {PASSOS.map((p, i) => (
          <li
            key={p}
            className={i === passo ? "font-medium text-[var(--color-text)]" : ""}
            data-passo-ativo={i === passo ? "1" : "0"}
          >
            {i + 1}. {p}
          </li>
        ))}
      </ol>

      {passo === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="campanha-passo-objetivo">
          <p className="sm:col-span-2 text-sm font-medium">Qual é o objetivo desta campanha?</p>
          {CARDS_DE_OBJETIVO.map((c) => (
            <button
              key={c.id}
              type="button"
              data-testid={`campanha-objetivo-${c.id}`}
              onClick={() => setObjetivo(c.id)}
              className={`rounded-[12px] p-4 text-left ring-1 ${
                objetivo === c.id
                  ? "bg-[var(--color-surface)] ring-[var(--color-accent)]"
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
        <div className="grid gap-3 md:grid-cols-3" data-testid="campanha-passo-segmento">
          <CampoSelect id="camp-tag" label="Tag" value={tag} onChange={setTag} opcoes={opcoes.data?.tags} />
          <CampoSelect id="camp-papel" label="Papel" value={papel} onChange={setPapel} opcoes={opcoes.data?.papeis} />
          <CampoSelect id="camp-origem" label="Origem" value={origem} onChange={setOrigem} opcoes={opcoes.data?.origens} />
          <CampoSelect
            id="camp-owner"
            label="Responsável"
            value={owner}
            onChange={setOwner}
            opcoes={(opcoes.data?.responsaveis ?? []).map((r) => r.id)}
          />
          <CampoSelect
            id="camp-funil"
            label="Funil"
            value={pipeline}
            onChange={(v) => {
              setPipeline(v);
              setStage("");
            }}
            opcoes={(opcoes.data?.funis ?? []).map((f) => f.id)}
            rotulos={Object.fromEntries((opcoes.data?.funis ?? []).map((f) => [f.id, f.name]))}
          />
          <CampoSelect
            id="camp-etapa"
            label="Etapa"
            value={stage}
            onChange={setStage}
            opcoes={(funil?.crm_stages ?? []).map((s) => s.id)}
            rotulos={Object.fromEntries((funil?.crm_stages ?? []).map((s) => [s.id, s.name]))}
          />
          <CampoSelect
            id="camp-temp"
            label="Temperatura"
            value={temperatura}
            onChange={setTemperatura}
            opcoes={["frio", "morno", "quente"]}
          />
          <div className="md:col-span-3">
            <Label htmlFor="camp-ids">Selecionar contatos (UUIDs)</Label>
            <Input
              id="camp-ids"
              value={contactIds}
              onChange={(e) => setContactIds(e.target.value)}
              placeholder="Cole IDs separados por vírgula"
            />
          </div>
          <p className="md:col-span-3 text-sm" data-testid="campanha-estimativa">
            {estimativa.data?.rotulo ?? "Estimando…"}
          </p>
          {estimativa.data ? (
            <p className="md:col-span-3 text-xs text-[var(--color-text-muted)]">
              E serão ignorados: {estimativa.data.exclusoes.bloqueados} bloqueados ·{" "}
              {estimativa.data.exclusoes.opt_out} opt-out · {estimativa.data.exclusoes.sem_whatsapp} sem
              WhatsApp · {estimativa.data.exclusoes.sem_email} sem e-mail
            </p>
          ) : null}
          {estimativa.data?.atinge_base_inteira ? (
            <p className="md:col-span-3 text-sm text-amber-700" data-testid="campanha-alerta-base">
              Esta campanha atingirá toda a sua base.
            </p>
          ) : null}
          {segmentoVazio(segmento) ? (
            <p className="md:col-span-3 text-xs text-[var(--color-text-muted)]">
              Sem filtro, o público é a base inteira — isso exige confirmação no Revisar.
            </p>
          ) : null}
          <div className="md:col-span-3">
            <Button type="button" variant="outline" data-testid="campanha-ver-contatos" onClick={() => setVerContatos((v) => !v)}>
              Ver contatos
            </Button>
            {verContatos ? (
              <ul className="mt-2 max-h-56 space-y-1 overflow-auto rounded-md border border-border p-2 text-sm" data-testid="campanha-preview-contatos">
                {(estimativa.data?.preview ?? []).map((c) => (
                  <li key={c.id}>
                    {c.nome} · {c.telefone ?? "sem WhatsApp"} · {c.email ?? "sem e-mail"}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {passo === 2 ? (
        <div className="grid gap-4 lg:grid-cols-2" data-testid="campanha-passo-mensagem">
          <div className="space-y-3">
            <div>
              <Label htmlFor="camp-nome">Nome da campanha</Label>
              <Input id="camp-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Começar com</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setBody("")}>
                  Em branco
                </Button>
                <span className="text-xs text-[var(--color-text-muted)] self-center">ou usar modelo pronto:</span>
              </div>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto" data-testid="campanha-modelos">
                {(modelos.data ?? []).map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="text-left text-sm underline"
                      data-testid={`campanha-usar-modelo-${m.id}`}
                      onClick={() => {
                        setNome(m.title);
                        setBody(m.body);
                      }}
                    >
                      {m.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Label htmlFor="camp-body">Mensagem</Label>
              <textarea
                id="camp-body"
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Variáveis: {`{{nome}}`} · {`{{telefone}}`} · {`{{email}}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["melhorar", "encurtar", "comercial", "profissional", "tres_versoes"] as const).map((acao) => (
                <Button
                  key={acao}
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid={`campanha-ia-${acao}`}
                  disabled={ia.isPending}
                  onClick={() =>
                    void ia.mutateAsync({ texto: body, acao }).then((r) => {
                      if (r.versoes[0]) setBody(r.versoes[0]);
                    })
                  }
                >
                  {acao === "tres_versoes" ? "Gerar 3 versões" : acao[0]!.toUpperCase() + acao.slice(1)}
                </Button>
              ))}
            </div>
            <div>
              <Label htmlFor="camp-midia">+ Adicionar mídia</Label>
              <Input
                id="camp-midia"
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
                data-testid="campanha-anexar-midia"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void uploadMidiaCampanha(file, rascunhoId ?? "draft").then((a) =>
                    setAnexos((prev) => [...prev, a]),
                  );
                }}
              />
              <ul className="mt-2 space-y-1 text-xs">
                {anexos.map((a) => (
                  <li key={a.storage_path} className="flex justify-between gap-2">
                    <span>
                      {a.filename} · {a.kind} · {Math.round(a.size_bytes / 1024)} KB
                    </span>
                    <button type="button" onClick={() => setAnexos((prev) => prev.filter((x) => x.storage_path !== a.storage_path))}>
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <Label htmlFor="camp-cta-label">Botão / CTA</Label>
                <Input id="camp-cta-label" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="camp-cta-url">Link</Label>
                <Input id="camp-cta-url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
              </div>
            </div>
          </div>
          <PreviewCanais
            texto={preview.texto}
            aba={previewAba}
            onAba={setPreviewAba}
            ok={preview.ok}
          />
        </div>
      ) : null}

      {passo === 3 ? (
        <div className="grid gap-3 sm:grid-cols-3" data-testid="campanha-passo-canal">
          <p className="sm:col-span-3 text-sm font-medium">Onde enviar?</p>
          {(
            [
              ["whatsapp", "WhatsApp"],
              ["email", "E-mail"],
              ["ambos", "WhatsApp + E-mail"],
            ] as const
          ).map(([id, titulo]) => (
            <button
              key={id}
              type="button"
              data-testid={`campanha-canal-${id}`}
              onClick={() => setCanais(id)}
              className={`rounded-[12px] p-4 text-left ring-1 ${
                canais === id ? "ring-[var(--color-accent)]" : "ring-[var(--color-border)]"
              } bg-[var(--color-surface)]`}
            >
              <p className="font-semibold">{titulo}</p>
            </button>
          ))}
          <p className="sm:col-span-3 text-sm">
            WhatsApp: {opcoes.data?.whatsapp.rotulo ?? "…"} · E-mail: {opcoes.data?.email.rotulo ?? "…"}
          </p>
          {(canais === "whatsapp" || canais === "ambos") && (opcoes.data?.sessoes.length ?? 0) > 0 ? (
            <div className="sm:col-span-3">
              <Label htmlFor="camp-sessao">Número de envio</Label>
              <select
                id="camp-sessao"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            <div className="sm:col-span-3">
              <Label htmlFor="camp-tpl">Modelo WhatsApp oficial</Label>
              <select
                id="camp-tpl"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={quando === "agora"} onChange={() => setQuando("agora")} />
            Enviar agora
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              data-testid="campanha-agendar"
              checked={quando === "agendar"}
              onChange={() => setQuando("agendar")}
            />
            Agendar
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
        <div className="space-y-3" data-testid="campanha-passo-revisar">
          <AppCard>
            <dl className="grid gap-2 text-sm md:grid-cols-2">
              <Item rotulo="Campanha" valor={nome} />
              <Item rotulo="Público" valor={estimativa.data?.rotulo ?? "—"} />
              <Item rotulo="Ignorados" valor={String(estimativa.data?.excluidos ?? 0)} />
              <Item rotulo="Canal" valor={canais} />
              <Item rotulo="Agendamento" valor={quando === "agora" ? "Agora" : agendado || "—"} />
              <Item rotulo="Mídia" valor={anexos.length ? anexos.map((a) => a.filename).join(", ") : "Nenhuma"} />
            </dl>
          </AppCard>
          <PreviewCanais texto={preview.texto} aba={previewAba} onAba={setPreviewAba} ok={preview.ok} />
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
          {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
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
        {passo < 5 ? (
          <Button data-testid="campanha-proximo" onClick={() => setPasso(passo + 1)}>
            Continuar
          </Button>
        ) : (
          <Button
            data-testid="campanha-enviar"
            disabled={!preview.ok || criar.isPending || iniciar.isPending}
            onClick={() => void disparar()}
          >
            {quando === "agendar" ? "Agendar campanha" : "Enviar campanha"}
          </Button>
        )}
      </div>
    </div>
  );
}

function CampoSelect({
  id,
  label,
  value,
  onChange,
  opcoes,
  rotulos,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  opcoes?: string[];
  rotulos?: Record<string, string>;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        list={`${id}-opts`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {opcoes && opcoes.length > 0 ? (
        <datalist id={`${id}-opts`}>
          {opcoes.map((o) => (
            <option key={o} value={o}>
              {rotulos?.[o] ?? o}
            </option>
          ))}
        </datalist>
      ) : null}
    </div>
  );
}

function PreviewCanais({
  texto,
  aba,
  onAba,
  ok,
}: {
  texto: string;
  aba: "whatsapp" | "email";
  onAba: (a: "whatsapp" | "email") => void;
  ok: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex gap-2">
        <Button type="button" size="sm" variant={aba === "whatsapp" ? "default" : "outline"} onClick={() => onAba("whatsapp")}>
          WhatsApp
        </Button>
        <Button type="button" size="sm" variant={aba === "email" ? "default" : "outline"} onClick={() => onAba("email")}>
          E-mail
        </Button>
      </div>
      <p className="mb-1 text-xs text-[var(--color-text-muted)]">Prévia com dados fictícios (Maria)</p>
      {aba === "whatsapp" ? (
        <blockquote
          className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50"
          data-testid="campanha-preview"
          data-ok={ok ? "1" : "0"}
        >
          <span data-testid="campanha-preview-whatsapp">{texto}</span>
        </blockquote>
      ) : (
        <div className="rounded-lg border border-border bg-[var(--color-surface)] p-3 text-sm" data-testid="campanha-preview-email">
          <p className="text-xs text-[var(--color-text-muted)]">Envelope da organização</p>
          <p className="mt-2 whitespace-pre-wrap">{texto}</p>
        </div>
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
