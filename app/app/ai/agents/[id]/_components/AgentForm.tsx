"use client";
/**
 * Form principal de configuração de um mcp_agent (Spec 12 §3 / S-13.11).
 *
 * Renderiza o agent + sua draft mais recente. Carregamento inicial vem do
 * Server Component pai (initial props). Mutations passam por:
 *   - `saveAgentDraftAction` (cria draft nova ou PATCH na existente)
 *   - `publishAgentAction` (versão draft → published; flip atômico via fn)
 *
 * Estados visíveis ao usuário:
 *   - "Publicado vN" (sem draft, valores espelham published)
 *   - "Rascunho vN+1" (sem published)
 *   - "Publicado vN + Rascunho vM" (formulário mostra a draft)
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TokenCounter } from "@/lib/ui/TokenCounter";
import { Info } from "@/lib/ui/icons";
import Link from "next/link";

import { TETO_TOOLS_POR_AGENTE } from "@/lib/mcp/tools/selecao-por-pacote";
import { PROVEDORES } from "@/lib/ai/pontos/provedores";

import { ModelPicker, useModelMeta } from "./ModelPicker";
import { escolherCredencialPadrao } from "@/lib/ai/agents/credencial-padrao";
import {
  DESCRICAO_EXEMPLO_LOCADORA,
  FERRAMENTAS_EXEMPLO_LOCADORA,
  FERRAMENTAS_OPERADOR_EXEMPLO_LOCADORA,
  HANDOFF_EXEMPLO_LOCADORA,
  MODELO_EXEMPLO_LOCADORA,
  PROMPT_EXEMPLO_LOCADORA,
  ehNomeDoExemploLocadora,
  ferramentasDoExemploEstaoPeladas,
  promptDoExemploEstaPelado,
} from "@/lib/moope/exemplo-assistente-locadora";
import { CHAVE_DA_INSTALACAO, CredentialPicker, findCredential } from "./CredentialPicker";
import { rotuloDoEstadoDoCanal } from "@/lib/channels/estado";
import { ToolPicker } from "./ToolPicker";
import { TriggerEditor, type TriggerValue } from "./TriggerEditor";
import { HandoffKeywordsInput } from "./HandoffKeywordsInput";
import { FollowupFlowPicker } from "./FollowupFlowPicker";
import { PainelDoOperador } from "./PainelDoOperador";
import { PainelDeSeguranca } from "./PainelDeSeguranca";
import { FunisDoAgente, type CoberturaPorFunil } from "./FunisDoAgente";
import { PublishConfirmDialog } from "./PublishConfirmDialog";
import {
  saveAgentDraftAction,
  publishAgentAction,
  createMcpAgentAction,
} from "../_actions";

import { versionCreateSchema, agentMcpCreateSchema } from "@/lib/ai/agents/validation";
import type { SelectableChannel as ChannelSessionLite } from "@/lib/channels/selectable";
import type { AgentRow } from "@/hooks/ai/useAgent";
import type { AgentVersionRow } from "@/hooks/ai/useAgentVersions";
import type { CredentialRow, Provider } from "@/hooks/ai/useCredentials";
import { credentialStatus } from "@/hooks/ai/useCredentials";
import type { FunilDaResposta } from "@/hooks/pipelines/usePipelines";

/**
 * O canal oferecido no seletor é exatamente o que `listSelectableChannels`
 * devolve — alias, e não uma cópia da forma, para que a tela não possa divergir
 * de quem monta a lista (é lá que mora o filtro de canal arquivado).
 */
export type { ChannelSessionLite };

interface BaseProps {
  credentials: CredentialRow[];
  /**
   * Provedores cujas chaves vieram na INSTALAÇÃO (o `.env`), e não da tela de
   * Credenciais. Sem isto, o editor exigia uma linha em `ai_provider_credentials`
   * que a instalação pelo kit nunca cria — e o dono caía numa tela onde não
   * conseguia salvar nada.
   */
  provedoresDaInstalacao?: string[];
  channelSessions: ChannelSessionLite[];
  routerMembership?: { routerId: string; routerName: string } | null;
  readOnly?: boolean;
}

interface EditProps extends BaseProps {
  mode: "edit";
  agent: AgentRow;
  /** Rascunho VIGENTE (mais novo que a publicada) — `null` se não há. */
  draft: AgentVersionRow | null;
  published: AgentVersionRow | null;
  /**
   * A versão de onde o formulário se hidrata: rascunho vigente > publicada >
   * última que existiu. Decidida em `lib/ai/agents/versoes-da-tela.ts`.
   */
  base?: AgentVersionRow | null;
  /** Rascunho anterior à publicada — mostrado como aviso, nunca aberto. */
  draftObsoleto?: AgentVersionRow | null;
}

interface CreateProps extends BaseProps {
  mode: "create";
}

type Props = (EditProps | CreateProps) & {
  /**
   * Os funis da organização, para a marcação de escopo (spec 17 passo 3).
   *
   * Vem por PROP e não por hook: a página já é server component e busca o resto
   * do contexto lá: um fetch client-side aqui faria a lista piscar vazia no
   * primeiro render, e "nenhum funil" é exatamente o estado que esta tela usa
   * para dizer algo importante.
   */
  funis?: FunilDaResposta[];
  /** Quanto de cada funil o assistente sabe percorrer (spec 17 passo 4). */
  cobertura?: CoberturaPorFunil;
};

interface FormState {
  name: string;
  description: string;
  priority: number;
  provider: Provider;
  model: string;
  credential_id: string;
  channel_session_id: string;
  system_prompt: string;
  tool_ids: string[];
  trigger_config: TriggerValue;
  max_steps: number;
  token_budget: number;
  cost_budget_cents: number;
  history_message_window: number;
  history_token_window: number;
  handoff_keywords: string[];
  handoff_tool_enabled: boolean;
  cases_enabled: boolean;
  split_messages: boolean;
  split_max_chars: number;
  followup: FollowupValue;
  // Papel OPERADOR (spec 16 §3.2) — o que mexe no sistema depois da conversa.
  operator_enabled: boolean;
  /** "" = herda o modelo do Conversador (vira null no payload). */
  operator_model: string;
  operator_tool_ids: string[];
  pipeline_ids: string[];
}

interface FollowupValue {
  enabled: boolean;
  flow_pointer_ids: string[];
}

const DEFAULT_FOLLOWUP: FollowupValue = { enabled: false, flow_pointer_ids: [] };

const PASSO_DO_CAMPO: Record<string, "quem" | "inteligencia" | "fala" | "faz" | "quando" | "ajustes"> = {
  name: "quem",
  description: "quem",
  channel_session_id: "quem",
  provider: "inteligencia",
  model: "inteligencia",
  credential_id: "inteligencia",
  system_prompt: "fala",
  split_max_chars: "fala",
  tool_ids: "faz",
};

const AJUDA_DO_PASSO = {
  quem: "Nome e o número de WhatsApp por onde ele atende.",
  inteligencia:
    "A empresa de IA e a chave. Se a instalação já tem uma chave, ela entra sozinha — você só troca se quiser outra.",
  fala: "O texto que ensina o tom. Escreva como você explicaria para um atendente novo.",
  faz: "O que ele pode consultar e quando passa para uma pessoa. O que estiver desligado, ele não faz.",
  quando: "Em que mensagem ele entra, e se retoma quem parou de responder.",
  ajustes: "Limites de custo e o tamanho das mensagens. O padrão já serve para começar.",
  tudo: "A configuração inteira numa tela. Os passos acima separam a mesma coisa.",
} as const;

const DEFAULT_TRIGGER: TriggerValue = {
  events: ["message"],
  filters: {
    ignore_groups: true,
    ignore_self: true,
    keyword_regex: null,
    business_hours: null,
  },
  concurrency: "one_per_conversation",
};

function buildState(args: {
  agent?: AgentRow;
  version: AgentVersionRow | null;
}): FormState {
  const { agent, version } = args;
  return {
    name: agent?.name ?? "",
    description: agent?.description ?? "",
    priority: agent?.priority ?? 0,
    provider: (version?.provider as Provider) ?? "anthropic",
    model: version?.model ?? "",
    // `null` gravado = a versão usa a chave da instalação. Sem esta tradução,
    // reabrir o agente mostraria o campo em branco e pediria para escolher de novo.
    credential_id: version ? (version.credential_id ?? CHAVE_DA_INSTALACAO) : "",
    channel_session_id: version?.channel_session_id ?? "",
    system_prompt:
      version?.system_prompt ??
      "Você é um atendente. Responda de forma educada e clara, em pt-BR.",
    tool_ids: version?.tool_ids ?? [],
    trigger_config: (version?.trigger_config as unknown as TriggerValue) ?? DEFAULT_TRIGGER,
    max_steps: version?.max_steps ?? 10,
    token_budget: version?.token_budget ?? 50_000,
    cost_budget_cents: version?.cost_budget_cents ?? 50,
    history_message_window: version?.history_message_window ?? 20,
    history_token_window: version?.history_token_window ?? 8_000,
    handoff_keywords: version?.handoff_keywords ?? [
      "falar com humano",
      "atendente",
      "pessoa real",
    ],
    handoff_tool_enabled: version?.handoff_tool_enabled ?? true,
    cases_enabled: version?.cases_enabled ?? false,
    split_messages: version?.split_messages ?? false,
    split_max_chars: version?.split_max_chars ?? 600,
    followup: version?.followup ?? DEFAULT_FOLLOWUP,
    operator_enabled: version?.operator_enabled ?? false,
    // O form usa "" onde o banco usa null — Select controlado não aceita null.
    // A conversão de volta acontece em `toVersionPayload`, num ponto só.
    operator_model: version?.operator_model ?? "",
    operator_tool_ids: version?.operator_tool_ids ?? [],
    // `?? []` = nenhum funil. Agente novo nasce fechado, como o banco.
    pipeline_ids: version?.pipeline_ids ?? [],
  };
}

function aplicarChavePadrao(
  estado: FormState,
  credenciais: CredentialRow[],
  provedoresDaInstalacao: string[],
): FormState {
  if (estado.credential_id) return estado;
  const escolhida = escolherCredencialPadrao({
    provider: estado.provider,
    instalacaoTemChave: provedoresDaInstalacao.includes(estado.provider),
    credenciais,
    tokenDaInstalacao: CHAVE_DA_INSTALACAO,
  });
  return escolhida ? { ...estado, credential_id: escolhida } : estado;
}

function comExemploLocadora(
  estado: FormState,
  nome: string | undefined,
  canais: { id: string; status: string }[],
): FormState {
  if (!ehNomeDoExemploLocadora(nome)) return estado;
  const peladoTexto = promptDoExemploEstaPelado(estado.system_prompt);
  const peladoTools = ferramentasDoExemploEstaoPeladas(estado.tool_ids);
  if (!peladoTexto && !peladoTools) return estado;
  const canalPronto =
    canais.find((c) => c.status === "working" || c.status === "WORKING") ?? canais[0];
  return {
    ...estado,
    description: estado.description.trim() ? estado.description : DESCRICAO_EXEMPLO_LOCADORA,
    system_prompt: peladoTexto ? PROMPT_EXEMPLO_LOCADORA : estado.system_prompt,
    tool_ids: peladoTools ? [...FERRAMENTAS_EXEMPLO_LOCADORA] : estado.tool_ids,
    handoff_keywords: peladoTexto ? [...HANDOFF_EXEMPLO_LOCADORA] : estado.handoff_keywords,
    handoff_tool_enabled: true,
    split_messages: true,
    split_max_chars: 480,
    operator_enabled: true,
    operator_tool_ids: peladoTools
      ? [...FERRAMENTAS_OPERADOR_EXEMPLO_LOCADORA]
      : estado.operator_tool_ids,
    model: estado.model || MODELO_EXEMPLO_LOCADORA,
    channel_session_id: estado.channel_session_id || canalPronto?.id || "",
  };
}

function toVersionPayload(s: FormState) {
  return {
    system_prompt: s.system_prompt,
    provider: s.provider,
    model: s.model,
    // O token é da TELA; o contrato da versão é `null` = chave da instalação.
    credential_id: s.credential_id === CHAVE_DA_INSTALACAO ? null : s.credential_id,
    tool_ids: s.tool_ids,
    trigger_config: s.trigger_config,
    channel_session_id: s.channel_session_id,
    max_steps: s.max_steps,
    token_budget: s.token_budget,
    cost_budget_cents: s.cost_budget_cents,
    history_message_window: s.history_message_window,
    history_token_window: s.history_token_window,
    handoff_keywords: s.handoff_keywords,
    handoff_tool_enabled: s.handoff_tool_enabled,
    cases_enabled: s.cases_enabled,
    split_messages: s.split_messages,
    split_max_chars: s.split_max_chars,
    followup: s.followup,
    operator_enabled: s.operator_enabled,
    // "" (não escolheu) → null (herda o do Conversador). São o mesmo conceito em
    // camadas diferentes, e o mapeamento vive AQUI para não se espalhar.
    operator_model: s.operator_model.trim() === "" ? null : s.operator_model.trim(),
    operator_tool_ids: s.operator_tool_ids,
    pipeline_ids: s.pipeline_ids,
  };
}

export function AgentForm(props: Props) {
  const funis = props.funis ?? [];
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const readOnly = props.readOnly ?? false;

  const baseline = React.useMemo(() => {
    if (isEdit) {
      // `base` já traz a regra (rascunho vigente > publicada > última versão).
      // O fallback existe para chamadores que ainda não a passam; sem ele, um
      // agente pausado abriria no texto padrão e o prompt "sumiria".
      const ref = props.base ?? props.draft ?? props.published;
      return comExemploLocadora(
        aplicarChavePadrao(
          buildState({ agent: props.agent, version: ref }),
          props.credentials,
          props.provedoresDaInstalacao ?? [],
        ),
        props.agent.name,
        props.channelSessions,
      );
    }
    return aplicarChavePadrao(
      buildState({ version: null }),
      props.credentials,
      props.provedoresDaInstalacao ?? [],
    );
  }, [isEdit, props]);

  const [form, setForm] = React.useState<FormState>(baseline);
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  /**
   * Qual papel está aberto. Estado LOCAL e não rota: trocar de papel não é
   * navegação — o rascunho é um só, e uma URL por papel faria o usuário achar
   * que salvou um e não o outro.
   */
  const [papel, setPapel] = React.useState<"conversa" | "operacao" | "seguranca">("conversa");
  const [passo, setPasso] = React.useState<
    "quem" | "inteligencia" | "fala" | "faz" | "quando" | "ajustes" | "tudo"
  >("quem");
  const ver = (alvo: typeof passo) => (passo === "tudo" || passo === alvo ? "" : "hidden");

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  function patch(p: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  // Quando provider muda, limpa credential e modelo (eles dependem do provider).
  function changeProvider(p: Provider) {
    const credential_id = escolherCredencialPadrao({
      provider: p,
      instalacaoTemChave: (props.provedoresDaInstalacao ?? []).includes(p),
      credenciais: props.credentials,
      tokenDaInstalacao: CHAVE_DA_INSTALACAO,
    });
    patch({ provider: p, credential_id, model: "" });
  }

  const cred = findCredential(props.credentials, form.credential_id);
  const credSt = cred ? credentialStatus(cred) : null;
  const channelSession = props.channelSessions.find((c) => c.id === form.channel_session_id);
  const modelMeta = useModelMeta(form.provider, form.model);

  // ---------------------------------------------------------------------
  // Validação (espelha versionCreateSchema, no client; server revalida).
  // ---------------------------------------------------------------------
  const validation = React.useMemo(() => {
    const errors: Record<string, string> = {};
    // As mensagens abaixo aparecem embaixo do campo ANTES de a pessoa tentar
    // salvar, então são escritas como INSTRUÇÃO ("dê um nome") e não como
    // acusação ("nome obrigatório") — um formulário recém-aberto acusando o
    // usuário de errar é a primeira coisa que ele vê nesta tela.
    if (form.name.trim().length === 0) errors.name = "Dê um nome para este agente.";
    if (form.name.length > 120) errors.name = "O nome pode ter até 120 caracteres.";
    if (form.system_prompt.trim().length < 10)
      errors.system_prompt = "Escreva as instruções do agente (pelo menos uma frase).";
    // `.trim()` porque é o que o servidor mede: `z.string().trim().max(20000)`
    // em lib/ai/agents/validation.ts — o trim roda ANTES do max. Duas réguas
    // diferentes barrariam aqui um texto que o servidor aceitaria.
    const tamanhoDoPrompt = form.system_prompt.trim().length;
    if (tamanhoDoPrompt > 20000)
      errors.system_prompt =
        `As instruções têm ${tamanhoDoPrompt.toLocaleString("pt-BR")} caracteres, e o máximo é 20.000. ` +
        `Corte ${(tamanhoDoPrompt - 20000).toLocaleString("pt-BR")} para conseguir salvar.`;
    if (!form.model) errors.model = "Escolha o modelo de inteligência artificial.";
    if (!form.credential_id)
      errors.credential_id = "Escolha a chave de acesso da empresa de inteligência artificial.";
    // Escolher "a chave desta instalação" para um provedor que a instalação NÃO
    // tem seria publicar um agente que morre em toda mensagem. A mesma recusa
    // existe no servidor (rota de versões); aqui ela chega antes do clique.
    if (
      form.credential_id === CHAVE_DA_INSTALACAO &&
      !(props.provedoresDaInstalacao ?? []).includes(form.provider)
    )
      errors.credential_id = `Esta instalação não tem chave de ${form.provider}. Escolha outra empresa de IA ou cadastre uma chave.`;
    if (!form.channel_session_id)
      errors.channel_session_id = "Escolha por qual número de WhatsApp ele atende.";
    if (form.tool_ids.length > TETO_TOOLS_POR_AGENTE)
      errors.tool_ids = `Máximo de ${TETO_TOOLS_POR_AGENTE} capacidades por agente.`;

    // Tenta o schema completo:
    if (Object.keys(errors).length === 0) {
      const parsed = versionCreateSchema.safeParse(toVersionPayload(form));
      if (!parsed.success) {
        const flat = parsed.error.flatten();
        const first = Object.entries(flat.fieldErrors)[0];
        if (first) errors[first[0]] = first[1]?.[0] ?? "Campo inválido.";
      }
    }
    return errors;
  }, [form]);

  const isValid = Object.keys(validation).length === 0;

  const publishBlockReason = React.useMemo(() => {
    if (!isEdit) return null;
    if (form.credential_id && form.credential_id !== CHAVE_DA_INSTALACAO) {
      if (!cred) return "Escolha a chave de acesso da empresa de inteligência artificial.";
      if (credSt !== "validated")
        return `A chave de ${form.provider} ${credSt === "invalid" ? "é inválida" : "ainda não foi validada"}.`;
    }
    if (channelSession && channelSession.status !== "working" && channelSession.status !== "WORKING")
      return `O WhatsApp não está conectado (status: ${channelSession.status}).`;
    return null;
  }, [isEdit, form.credential_id, form.provider, cred, credSt, channelSession]);

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------

  function apontarOQueFalta() {
    const chave = Object.keys(validation)[0];
    const destino = chave ? PASSO_DO_CAMPO[chave] : undefined;
    if (destino) setPasso(destino);
    toast.error(Object.values(validation)[0] ?? "Formulário inválido.");
  }

  async function handleSave() {
    if (!isValid) {
      apontarOQueFalta();
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const res = await saveAgentDraftAction(props.agent.id, toVersionPayload(form));
        if (!res.ok) {
          toast.error(res.message ?? `Erro: ${res.error}`);
          return;
        }
        toast.success(`Rascunho v${res.data!.version_number} salvo.`);
        router.refresh();
      } else {
        const payload = {
          name: form.name,
          description: form.description.trim() === "" ? undefined : form.description,
          priority: form.priority,
          version: toVersionPayload(form),
        };
        const validated = agentMcpCreateSchema.safeParse(payload);
        if (!validated.success) {
          toast.error("Validação falhou.");
          return;
        }
        const res = await createMcpAgentAction(validated.data);
        if (!res.ok) {
          toast.error(res.message ?? `Erro: ${res.error}`);
          return;
        }
        toast.success("Agent criado.");
        router.push(`/app/ai/agents/${res.data!.agent_id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  function pedirPublicacao() {
    if (!isEdit) return;
    if (!isValid) {
      apontarOQueFalta();
      return;
    }
    if (publishBlockReason) {
      toast.error(publishBlockReason);
      if (publishBlockReason.startsWith("O WhatsApp")) setPasso("quem");
      if (publishBlockReason.startsWith("A chave") || publishBlockReason.startsWith("Escolha a chave"))
        setPasso("inteligencia");
      return;
    }
    if (props.published) {
      setConfirmOpen(true);
      return;
    }
    void executarPublicacao();
  }

  async function executarPublicacao() {
    if (!isEdit) return;
    setPublishing(true);
    try {
      let versionId = !dirty && props.draft ? props.draft.id : null;
      if (!versionId) {
        const salvo = await saveAgentDraftAction(props.agent.id, toVersionPayload(form));
        if (!salvo.ok || !salvo.data) {
          toast.error(!salvo.ok ? (salvo.message ?? `Erro: ${salvo.error}`) : "Não consegui gravar.");
          return;
        }
        versionId = salvo.data.version_id;
      }
      const res = await publishAgentAction(props.agent.id, versionId);
      if (!res.ok) {
        toast.error(`Falha ao publicar: ${res.error}`);
        return;
      }
      toast.success("Publicado. Este assistente passa a responder neste WhatsApp.");
      setConfirmOpen(false);
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  function handleReset() {
    setForm(baseline);
  }

  const disabled = readOnly || saving || publishing;

  // Status badge
  const statusBadge = (() => {
    if (!isEdit) return <Badge variant="secondary">Novo</Badge>;
    const pubN = props.published?.version_number;
    const draftN = props.draft?.version_number;
    if (pubN && draftN) {
      return (
        <Badge variant="secondary">
          Publicado v{pubN} + Rascunho v{draftN}
        </Badge>
      );
    }
    if (pubN) {
      // O rascunho anterior à publicada não abre nem publica — mas some da tela
      // sem explicação se ninguém o nomear, e aí o autor procura por um trabalho
      // que acha ter perdido. Ele continua no Histórico.
      const obsoleta = props.draftObsoleto?.version_number;
      return (
        <Badge variant="default" title={obsoleta ? `O rascunho v${obsoleta} é anterior a esta versão e foi superado por ela — ele continua no Histórico.` : undefined}>
          Publicado v{pubN}
          {obsoleta ? ` (rascunho v${obsoleta} superado)` : ""}
        </Badge>
      );
    }
    if (draftN) return <Badge variant="outline">Rascunho v{draftN}</Badge>;
    // Sem rascunho e sem publicada: o formulário abriu da última versão que
    // existiu (props.base), e não do texto padrão. Dizer isso é o que impede o
    // autor de achar que o prompt sumiu — e de salvar por cima achando que não.
    if (props.base) {
      return <Badge variant="outline">Pausado · editando a v{props.base.version_number}</Badge>;
    }
    return <Badge variant="outline">Sem versão</Badge>;
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              {isEdit ? props.agent.name : "Novo agente"}
            </h2>
            {statusBadge}
          </div>
          {isEdit && props.agent.description ? (
            <p className="text-xs text-muted-foreground">{props.agent.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEdit ? (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!dirty || disabled}
            >
              Descartar alterações
            </Button>
          ) : null}
          <Button onClick={handleSave} disabled={(!dirty && isEdit) || disabled || !isValid}>
            {saving ? "Salvando…" : isEdit ? "Salvar rascunho" : "Criar agente"}
          </Button>
          {isEdit ? (
            <Button variant="default" onClick={pedirPublicacao} disabled={disabled}>
              {publishing ? "Publicando…" : "Publicar"}
            </Button>
          ) : null}
        </div>
        {isEdit ? (
          <p className="w-full text-xs text-muted-foreground">
            Publicar coloca este assistente no ar neste WhatsApp — ele passa a responder as
            mensagens desse número. No fluxo do bot, o bloco Assistente só lista quem já está
            publicado, para você escolher em qual caminho ele entra.
            {publishBlockReason ? ` ${publishBlockReason}` : ""}
            {!isValid ? ` ${Object.values(validation)[0] ?? ""} O Publicar leva você até esse campo.` : ""}
          </p>
        ) : null}
      </div>

      {/*
        NAVEGAÇÃO POR PAPEL (spec 16 §6). Um form só, um save só — os papéis são
        SEÇÕES, não telas separadas: separá-las em abas com save próprio faria o
        usuário publicar metade da configuração e criaria dois caminhos para o
        mesmo `ai_agent_versions`.

        Os rótulos dizem o que cada papel FAZ. "Conversador"/"Operador" é o nosso
        vocabulário interno; quem configura pensa em "quem fala com meu cliente" e
        "quem organiza minha casa".
      */}
      <div className="flex flex-wrap gap-1 border-b" role="tablist" aria-label="Papéis do agente">
        {(
          [
            ["conversa", "Conversa com o cliente"],
            ["operacao", "Organiza o sistema"],
            // O TERCEIRO PAPEL. O rótulo diz o que ele FAZ, como os outros dois:
            // "Segurança" é o nosso nome; quem configura quer saber o que é
            // conferido antes de a mensagem chegar ao cliente dele.
            ["seguranca", "Confere antes de enviar"],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={papel === id}
            data-testid={`papel-${id}`}
            onClick={() => setPapel(id)}
            className={
              papel === id
                ? "border-b-2 border-foreground px-3 py-2 text-sm font-medium"
                : "border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {rotulo}
          </button>
        ))}
      </div>

      {papel === "conversa" ? (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Passos da configuração">
          {(
            [
              ["quem", "1. Quem é"],
              ["inteligencia", "2. Inteligência"],
              ["fala", "3. Como fala"],
              ["faz", "4. O que faz"],
              ["quando", "5. Quando entra"],
              ["ajustes", "6. Ajustes"],
              ["tudo", "Ver tudo"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              data-testid={`passo-${id}`}
              aria-selected={passo === id}
              onClick={() => setPasso(id)}
              className={
                passo === id
                  ? "rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background"
                  : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {rotulo}
            </button>
          ))}
          <p className="w-full text-xs text-muted-foreground">
            {AJUDA_DO_PASSO[passo]} Salvar grava o assistente inteiro, não só este passo.
          </p>
        </div>
      ) : null}

      {papel === "seguranca" ? <PainelDeSeguranca /> : null}

      {papel === "operacao" ? (
        <PainelDoOperador
          enabled={form.operator_enabled}
          onEnabledChange={(v) => patch({ operator_enabled: v })}
          model={form.operator_model}
          onModelChange={(v) => patch({ operator_model: v })}
          provider={form.provider}
          toolIds={form.operator_tool_ids}
          onToolIdsChange={(ids) => patch({ operator_tool_ids: ids })}
          modeloDoConversador={form.model}
          disabled={disabled}
        />
      ) : null}

      {/* Fica na aba de OPERAÇÃO e não na de conversa: é permissão de mexer em
          negócio, não de falar com cliente — a mesma separação que a spec 16
          impôs no resto da tela. */}
      {papel === "operacao" ? (
        <FunisDoAgente
          funis={funis}
          cobertura={props.cobertura}
          value={form.pipeline_ids}
          onChange={(ids) => patch({ pipeline_ids: ids })}
          disabled={disabled}
        />
      ) : null}

      {/* Two-column grid */}
      <div
        className={
          papel === "conversa"
            ? `grid grid-cols-1 gap-4 ${passo === "tudo" ? "lg:grid-cols-2" : "mx-auto w-full max-w-3xl"}`
            : "hidden"
        }
      >
        {/* COLUMN 1 */}
        <div className="space-y-4">
          {/* Identification */}
          <Card className={`space-y-3 p-4 ${ver("quem")}`}>
            {isEdit &&
            ehNomeDoExemploLocadora(props.agent.name) &&
            (promptDoExemploEstaPelado(
              (props.base ?? props.draft ?? props.published)?.system_prompt,
            ) ||
              ferramentasDoExemploEstaoPeladas(
                (props.base ?? props.draft ?? props.published)?.tool_ids,
              )) ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                Este é o exemplo da locadora, já preenchido. Salve para ele valer nas conversas.
                Pode editar o texto antes.
              </p>
            ) : null}
            <h3 className="text-sm font-medium">Quem é este agente</h3>
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                disabled={disabled}
                maxLength={120}
                aria-invalid={!!validation.name}
              />
              {validation.name ? (
                <p className="text-xs text-destructive">{validation.name}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                disabled={disabled}
                rows={2}
                maxLength={2000}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="priority">Ordem de preferência (0 a 1000)</Label>
              <Input
                id="priority"
                type="number"
                min={0}
                max={1000}
                step={1}
                value={form.priority}
                onChange={(e) => patch({ priority: Number(e.target.value) })}
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">
                Quando mais de um agente puder atender a mesma conversa, o de número
                maior tenta primeiro. Se você só tem um agente, pode deixar como está.
              </p>
            </div>
          </Card>

          {/* Provider + credential + model */}
          <Card className={`space-y-3 p-4 ${ver("inteligencia")}`}>
            <h3 className="text-sm font-medium">A inteligência que ele usa</h3>
            <div className="space-y-1">
              <Label htmlFor="provider">Empresa de inteligência artificial</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => changeProvider(v as Provider)}
                disabled={disabled}
              >
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/*
                    Derivado de PROVEDORES, nunca escrito à mão: esta lista tinha
                    três itens fixos enquanto o sistema executava quatro, e a
                    OpenRouter — a opção [1] do instalador — não aparecia. Um
                    agente publicado nela abria com o campo em BRANCO, porque
                    nenhum item casava com o valor, e o primeiro save silencioso
                    trocava o provedor do dono por outro.
                  */}
                  {PROVEDORES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ModelPicker
              provider={form.provider}
              value={form.model}
              onChange={(modelId) => patch({ model: modelId })}
              disabled={disabled}
              id="model"
            />
            {validation.model ? (
              <p className="text-xs text-destructive">{validation.model}</p>
            ) : null}

            <CredentialPicker
              provider={form.provider}
              credentials={props.credentials}
              value={form.credential_id}
              onChange={(id) => patch({ credential_id: id })}
              disabled={disabled}
              id="credential_id"
              instalacaoTemChave={(props.provedoresDaInstalacao ?? []).includes(form.provider)}
            />
            {validation.credential_id ? (
              <p className="text-xs text-destructive">{validation.credential_id}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                A chave padrão entra sozinha: a desta instalação, ou a única chave validada
                desta empresa. Com mais de uma, você escolhe qual este assistente usa.
              </p>
            )}
            {cred && credSt !== "validated" ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Credencial selecionada está com status {credSt}. Publish bloqueado até validar.
              </p>
            ) : null}
          </Card>

          {/* WhatsApp session */}
          <Card className={`space-y-3 p-4 ${ver("quem")}`}>
            <h3 className="text-sm font-medium">Por qual número ele atende</h3>
            {props.routerMembership && (
              <div className="flex items-start gap-2 rounded-md bg-accent-soft p-3 text-xs text-text-muted">
                <Info className="mt-0.5 shrink-0" aria-hidden />
                <p>
                  Este agente é acionado pelo roteador{" "}
                  <Link
                    href={`/app/ai/routers/${props.routerMembership.routerId}`}
                    className="font-medium underline underline-offset-2"
                  >
                    «{props.routerMembership.routerName}»
                  </Link>{" "}
                  — o campo de número abaixo não se aplica.
                </p>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="channel_session_id">Número conectado</Label>
              <Select
                value={form.channel_session_id || undefined}
                onValueChange={(v) => patch({ channel_session_id: v })}
                disabled={disabled}
              >
                <SelectTrigger id="channel_session_id">
                  <SelectValue placeholder="Selecione um número" />
                </SelectTrigger>
                <SelectContent>
                  {props.channelSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {/*
                        O estado vinha CRU daqui — a opção lia "org_2dd5e6ea ·
                        STARTING", juntando o identificador interno da sessão com
                        o enum em inglês do banco. O nome agora nunca é o
                        identificador (ver `nomeDoCanal`), e o estado passa pela
                        mesma tradução que a tela de Conexões usa.
                      */}
                      {s.display_name}
                      {s.phone_number ? ` · ${s.phone_number}` : ""} ·{" "}
                      {rotuloDoEstadoDoCanal(s.status)}
                    </SelectItem>
                  ))}
                  {props.channelSessions.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      Nenhum número conectado
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
              {validation.channel_session_id ? (
                <p className="text-xs text-destructive">{validation.channel_session_id}</p>
              ) : null}
            </div>
          </Card>

          {/* Limits */}
          <Card className={`space-y-3 p-4 ${ver("ajustes")}`}>
            <h3 className="text-sm font-medium">Freios de segurança</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="max_steps">Ações por atendimento (1 a 25)</Label>
                <Input
                  id="max_steps"
                  type="number"
                  min={1}
                  max={25}
                  value={form.max_steps}
                  onChange={(e) => patch({ max_steps: Number(e.target.value) })}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="token_budget">Volume de texto por atendimento</Label>
                <Input
                  id="token_budget"
                  type="number"
                  min={1000}
                  max={500000}
                  step={1000}
                  value={form.token_budget}
                  onChange={(e) => patch({ token_budget: Number(e.target.value) })}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cost_budget_cents">Custo máximo por atendimento (centavos)</Label>
                <Input
                  id="cost_budget_cents"
                  type="number"
                  min={1}
                  max={10000}
                  value={form.cost_budget_cents}
                  onChange={(e) => patch({ cost_budget_cents: Number(e.target.value) })}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="history_message_window">Mensagens anteriores que ele lê</Label>
                <Input
                  id="history_message_window"
                  type="number"
                  min={0}
                  max={200}
                  value={form.history_message_window}
                  onChange={(e) =>
                    patch({ history_message_window: Number(e.target.value) })
                  }
                  disabled={disabled}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="history_token_window">Tamanho máximo desse histórico</Label>
                <Input
                  id="history_token_window"
                  type="number"
                  min={0}
                  max={50000}
                  step={500}
                  value={form.history_token_window}
                  onChange={(e) =>
                    patch({ history_token_window: Number(e.target.value) })
                  }
                  disabled={disabled}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* COLUMN 2 */}
        <div className="space-y-4">
          {/* Prompt */}
          <Card className={`space-y-2 p-4 ${ver("fala")}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">As instruções dele</h3>
              <div className="flex items-center gap-2">
                {/* O contador é o aviso que chega ANTES do erro: quem cola um
                    texto grande vê na hora que ele não vai caber, em vez de
                    descobrir depois — ou nunca. */}
                <span
                  data-testid="contador-do-prompt"
                  className={
                    form.system_prompt.trim().length > 20000
                      ? "text-xs text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {form.system_prompt.trim().length.toLocaleString("pt-BR")}/20.000
                </span>
                <TokenCounter
                  text={form.system_prompt}
                  contextWindow={modelMeta?.context_window ?? null}
                  className="text-xs"
                />
              </div>
            </div>
            <Textarea
              value={form.system_prompt}
              onChange={(e) => patch({ system_prompt: e.target.value })}
              disabled={disabled}
              rows={12}
              /**
               * SEM `maxLength`, e é o conserto — não um esquecimento.
               *
               * O navegador aplica o atributo na COLAGEM, sem evento e sem
               * aviso: o que passa do limite não entra no campo. Cinco versões
               * de um agente em produção foram salvas com exatamente 19.999
               * caracteres, a última cortada no meio de uma frase, e o aviso
               * logo acima — "passaram de 20.000" — era inalcançável, porque o
               * estado nunca podia exceder o teto que o atributo já impunha.
               *
               * Sem ele o texto inteiro entra, a validação dispara e o autor lê
               * quanto precisa cortar. Limite que recusa é honesto; limite que
               * corta em silêncio faz o autor publicar o que não escreveu.
               */
              spellCheck={false}
              className="font-mono text-xs"
              aria-invalid={!!validation.system_prompt}
            />
            {validation.system_prompt ? (
              <p className="text-xs text-destructive">{validation.system_prompt}</p>
            ) : null}
          </Card>

          {/* Estilo de resposta (split de mensagens — Onda 4) */}
          <Card className={`space-y-3 p-4 ${ver("fala")}`}>
            <h3 className="text-sm font-medium">Estilo de resposta</h3>
            <div className="flex items-center gap-2">
              <Switch
                id="split_messages"
                checked={form.split_messages}
                onCheckedChange={(v) => patch({ split_messages: v })}
                disabled={disabled}
              />
              <Label htmlFor="split_messages">
                Responder em várias mensagens curtas (como uma pessoa digita)
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Em vez de um bloco único, a resposta sai em bolhas separadas, espaçadas pelo
              mesmo ritmo anti-banimento do envio. O agente também é instruído a escrever
              em parágrafos curtos.
            </p>
            {form.split_messages ? (
              <div className="space-y-1">
                <Label htmlFor="split_max_chars">Tamanho máximo por bolha (80–4000)</Label>
                <Input
                  id="split_max_chars"
                  type="number"
                  min={80}
                  max={4000}
                  step={20}
                  value={form.split_max_chars}
                  onChange={(e) => patch({ split_max_chars: Number(e.target.value) })}
                  disabled={disabled}
                  aria-invalid={!!validation.split_max_chars}
                />
                {validation.split_max_chars ? (
                  <p className="text-xs text-destructive">{validation.split_max_chars}</p>
                ) : null}
              </div>
            ) : null}
          </Card>

          {/* Capacidades */}
          <Card className={`space-y-2 p-4 ${ver("faz")}`}>
            <h3 className="text-sm font-medium">O que o agente pode fazer</h3>
            <p className="text-xs text-muted-foreground">
              Ligue por jornada de trabalho. O agente só consegue fazer o que estiver
              ligado aqui — e o que estiver ligado, ele fará sozinho durante o atendimento.
            </p>
            <ToolPicker
              value={form.tool_ids}
              onChange={(ids) => patch({ tool_ids: ids })}
              disabled={disabled}
            />
            {validation.tool_ids ? (
              <p className="text-xs text-destructive">{validation.tool_ids}</p>
            ) : null}
          </Card>

          {/* Triggers */}
          <Card className={`space-y-2 p-4 ${ver("quando")}`}>
            <h3 className="text-sm font-medium">Quando ele entra em ação</h3>
            <TriggerEditor
              value={form.trigger_config}
              onChange={(v) => patch({ trigger_config: v })}
              disabled={disabled}
            />
          </Card>

          {/* Handoff */}
          <Card className={`space-y-3 p-4 ${ver("faz")}`}>
            <h3 className="text-sm font-medium">Passar para uma pessoa</h3>
            <div className="flex items-center gap-2">
              <Switch
                id="handoff_tool_enabled"
                checked={form.handoff_tool_enabled}
                onCheckedChange={(v) => patch({ handoff_tool_enabled: v })}
                disabled={disabled}
              />
              <Label htmlFor="handoff_tool_enabled">
                Deixar o agente chamar uma pessoa quando perceber que não é caso dele
              </Label>
            </div>
            <HandoffKeywordsInput
              value={form.handoff_keywords}
              onChange={(v) => patch({ handoff_keywords: v })}
              disabled={disabled}
            />
          </Card>

          {/* Casos humanos */}
          <Card className={`space-y-3 p-4 ${ver("faz")}`}>
            <h3 className="text-sm font-medium">Pedir ajuda sem sair da conversa</h3>
            <div className="flex items-center gap-2">
              <Switch
                id="cases_enabled"
                checked={form.cases_enabled}
                onCheckedChange={(v) => patch({ cases_enabled: v })}
                disabled={disabled}
              />
              <Label htmlFor="cases_enabled">
                Deixar o agente pedir uma tarefa a alguém e seguir conversando
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Diferente de passar a conversa: aqui o agente continua atendendo. Quando
              esbarra em algo que só uma pessoa resolve — aprovar um desconto, por
              exemplo — ele abre um pedido interno e retoma assim que for respondido.
            </p>
          </Card>

          {/* Follow-up */}
          <Card className={`space-y-3 p-4 ${ver("quando")}`}>
            <h3 className="text-sm font-medium">Follow-up</h3>
            <p className="text-xs text-muted-foreground">
              Retomar sozinho quem parou de responder, para o interessado não sumir
              sem ninguém perceber.
            </p>
            <div className="flex items-center gap-2">
              <Switch
                id="followup_enabled"
                checked={form.followup.enabled}
                onCheckedChange={(v) =>
                  patch({ followup: { ...form.followup, enabled: v } })
                }
                disabled={disabled}
              />
              <Label htmlFor="followup_enabled">
                Habilitar gatilhos automáticos de follow-up
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Os fluxos abaixo só entram em ação para um cliente se
              este agente estiver publicado com follow-up habilitado.
            </p>
            <FollowupFlowPicker
              value={form.followup.flow_pointer_ids}
              onChange={(ids) =>
                patch({ followup: { ...form.followup, flow_pointer_ids: ids } })
              }
              disabled={disabled}
            />
          </Card>
        </div>
      </div>

      {/* Publish dialog */}
      {isEdit && props.published ? (
        <PublishConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          draft={dirty ? null : props.draft}
          published={props.published}
          onConfirm={() => void executarPublicacao()}
          isPending={publishing}
        />
      ) : null}
    </div>
  );
}
