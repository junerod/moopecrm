"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DadosEFerramentasDoAssistente } from "@/components/ai/DadosEFerramentasDoAssistente";
import { GuardrailsEditor } from "@/components/ai/GuardrailsEditor";
import { SystemPromptEditor } from "@/components/ai/SystemPromptEditor";
import { useAgent, useUpdateAgent, type AgentRow } from "@/hooks/ai/useAgent";
import type { CapacidadeAmigavel } from "@/lib/business-packs/capacidades";
import { rotuloDoModoIa } from "@/lib/negocio/rotulos";
import {
  AGENT_CONFIG_DEFAULTS,
  AGENT_MODELS,
  ROTULO_DO_MODELO,
  agentConfigSchema,
  agentPatchSchema,
  guardrailsSchema,
  modeloInicialDoAgente,
  type AgentConfig,
  type AgentModel,
  type AgentPatch,
  type GuardrailItem,
} from "@/lib/ai/guardrails-schema";

interface Props {
  agentId: string;
  initialData?: AgentRow;
  readOnly?: boolean;
  papel?: string | null;
  capacidades?: CapacidadeAmigavel[];
  aiMode?: string;
}

interface FormState {
  name: string;
  description: string;
  is_active: boolean;
  model: AgentModel;
  system_prompt: string;
  config: AgentConfig;
  guardrails: GuardrailItem[];
}

function opcoesDeModelo(atual: string): string[] {
  if ((AGENT_MODELS as readonly string[]).includes(atual)) return [...AGENT_MODELS];
  return [atual, ...AGENT_MODELS];
}

function buildFormState(agent: AgentRow): FormState {
  const cfgRaw = (agent.config ?? {}) as Record<string, unknown>;
  const cfgParsed = agentConfigSchema.safeParse({ ...AGENT_CONFIG_DEFAULTS, ...cfgRaw });
  const config: AgentConfig = cfgParsed.success ? cfgParsed.data : AGENT_CONFIG_DEFAULTS;

  const grRaw = Array.isArray(agent.guardrails) ? agent.guardrails : [];
  const grParsed = guardrailsSchema.safeParse(grRaw);
  const guardrails: GuardrailItem[] = grParsed.success ? grParsed.data : [];

  const model = modeloInicialDoAgente(agent.model);

  return {
    name: agent.name,
    description: agent.description ?? "",
    is_active: agent.is_active,
    model,
    system_prompt: agent.system_prompt,
    config,
    guardrails,
  };
}

function diffPatch(initial: FormState, current: FormState): AgentPatch {
  const patch: AgentPatch = {};
  if (initial.name !== current.name) patch.name = current.name;
  if (initial.description !== current.description) {
    patch.description = current.description.trim() === "" ? null : current.description;
  }
  if (initial.is_active !== current.is_active) patch.is_active = current.is_active;
  if (initial.model !== current.model) patch.model = current.model;
  if (initial.system_prompt !== current.system_prompt)
    patch.system_prompt = current.system_prompt;
  if (JSON.stringify(initial.config) !== JSON.stringify(current.config)) {
    patch.config = current.config;
  }
  if (JSON.stringify(initial.guardrails) !== JSON.stringify(current.guardrails)) {
    patch.guardrails = current.guardrails;
  }
  return patch;
}

export function AgentEditor({
  agentId,
  initialData,
  readOnly = false,
  papel = null,
  capacidades = [],
  aiMode = "off",
}: Props) {
  const query = useAgent(agentId, { initialData });
  const update = useUpdateAgent(agentId);

  const agent = query.data;

  const [formState, setFormState] = React.useState<FormState | null>(
    agent ? buildFormState(agent) : null,
  );
  const [baselineState, setBaselineState] = React.useState<FormState | null>(
    agent ? buildFormState(agent) : null,
  );

  // Sync state quando dados frescos chegam (ex: refetch / SSR initialData).
  React.useEffect(() => {
    if (!agent) return;
    setFormState((prev) => prev ?? buildFormState(agent));
    setBaselineState((prev) => prev ?? buildFormState(agent));
  }, [agent]);

  if (!agent || !formState || !baselineState) {
    return <p className="text-sm text-muted-foreground">Carregando assistente…</p>;
  }

  const dirty = JSON.stringify(formState) !== JSON.stringify(baselineState);

  function patchForm(p: Partial<FormState>) {
    setFormState((prev) => (prev ? { ...prev, ...p } : prev));
  }

  function patchConfig(p: Partial<AgentConfig>) {
    setFormState((prev) => (prev ? { ...prev, config: { ...prev.config, ...p } } : prev));
  }

  async function handleSave() {
    if (!formState || !baselineState) return;

    // Valida guardrails antes de enviar
    const grCheck = guardrailsSchema.safeParse(formState.guardrails);
    if (!grCheck.success) {
      const flat = grCheck.error.flatten();
      const firstErr =
        Object.values(flat.fieldErrors)[0]?.[0] ?? flat.formErrors[0] ?? "Regras inválidas.";
      toast.error(`Regras inválidas: ${firstErr}`);
      return;
    }

    const patch = diffPatch(baselineState, formState);
    if (Object.keys(patch).length === 0) {
      toast.info("Nada para salvar.");
      return;
    }

    const validated = agentPatchSchema.safeParse(patch);
    if (!validated.success) {
      const flat = validated.error.flatten();
      const firstErr =
        Object.values(flat.fieldErrors)[0]?.[0] ?? flat.formErrors[0] ?? "Campos inválidos.";
      toast.error(`Erro ao salvar: ${firstErr}`);
      return;
    }

    try {
      const updated = await update.mutateAsync(validated.data);
      const next = buildFormState(updated);
      setBaselineState(next);
      setFormState(next);
    } catch {
      // toast já mostrado em onError do hook
    }
  }

  function handleReset() {
    setFormState(baselineState);
  }

  const disabled = readOnly || update.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{agent.name}</h2>
          {papel ? <p className="text-sm text-muted-foreground">{papel}</p> : null}
          <p className="mt-1 text-xs font-medium uppercase tracking-wide" data-testid="assistente-editor-status">
            {formState.is_active ? "Ativo" : "Inativo"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!dirty || disabled}>
            Descartar
          </Button>
          <Button onClick={handleSave} disabled={!dirty || disabled}>
            {update.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview" data-testid="tab-visao-geral">
            Visão geral
          </TabsTrigger>
          <TabsTrigger value="instructions" data-testid="tab-instrucoes">
            Instruções
          </TabsTrigger>
          <TabsTrigger value="knowledge" data-testid="tab-conhecimento">
            Conhecimento
          </TabsTrigger>
          <TabsTrigger value="tools" data-testid="tab-dados">
            Dados e ferramentas
          </TabsTrigger>
          <TabsTrigger value="autonomy" data-testid="tab-autonomia">
            Autonomia
          </TabsTrigger>
          <TabsTrigger value="advanced" data-testid="tab-avancado">
            Avançado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="space-y-4 p-4">
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formState.name}
                onChange={(e) => patchForm({ name: e.target.value })}
                disabled={disabled}
                maxLength={120}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">O que ele faz</Label>
              <Textarea
                id="description"
                value={formState.description}
                onChange={(e) => patchForm({ description: e.target.value })}
                disabled={disabled}
                rows={3}
                maxLength={500}
                placeholder="Descrição interna do assistente"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formState.is_active}
                onCheckedChange={(v) => patchForm({ is_active: v })}
                disabled={disabled}
                id="is_active"
              />
              <Label htmlFor="is_active">Assistente ativo</Label>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="instructions">
          <Card className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              Como este assistente conversa. Não invente preço, prazo nem dado operacional
              aqui — isso vem do conhecimento ou da gestão.
            </p>
            <SystemPromptEditor
              value={formState.system_prompt}
              onChange={(v) => patchForm({ system_prompt: v })}
              disabled={disabled}
            />
          </Card>
        </TabsContent>

        <TabsContent value="knowledge">
          <Card className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              Este assistente consulta o conhecimento da empresa. Escolha as coleções na
              tela de Conhecimento.
            </p>
            <Button asChild variant="outline" size="sm">
              <a href={`/app/ai/knowledge/sources?agent=${agentId}`}>Definir conhecimento</a>
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="tools">
          <Card className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              Dados que este assistente pode consultar. Nada é enviado para o cliente sem
              a gestão conectada.
            </p>
            <DadosEFerramentasDoAssistente capacidades={capacidades} />
          </Card>
        </TabsContent>

        <TabsContent value="autonomy">
          <Card className="space-y-4 p-4">
            <p className="text-sm">
              Autonomia da empresa agora: <strong>{rotuloDoModoIa(aiMode)}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              O assistente segue o modo da organização. Para mudar, use Configurações de
              atendimento — não é uma regra só deste assistente.
            </p>
            <div className="flex items-center gap-3">
              <Switch
                checked={formState.is_active}
                onCheckedChange={(v) => patchForm({ is_active: v })}
                disabled={disabled}
                id="is_active_autonomy"
              />
              <Label htmlFor="is_active_autonomy">Este assistente está ligado</Label>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="advanced">
          <Card className="space-y-6 p-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Quem conversa com o cliente</h3>
              <p className="text-xs text-muted-foreground">
                Isto não é a chave de documentos. Chave da OpenAI em Credenciais lê
                material e áudio. Aqui você escolhe o cérebro da conversa — GPT se a
                chave for OpenAI, Claude se for Anthropic.
              </p>
              <Select
                value={formState.model}
                onValueChange={(v) => patchForm({ model: v as AgentModel })}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opcoesDeModelo(formState.model).map((m) => (
                    <SelectItem key={m} value={m}>
                      {ROTULO_DO_MODELO[m as keyof typeof ROTULO_DO_MODELO] ?? m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Criatividade (0–2)</Label>
                  <Input
                    type="number"
                    step="0.05"
                    min={0}
                    max={2}
                    value={formState.config.temperature}
                    onChange={(e) => patchConfig({ temperature: Number(e.target.value) })}
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tamanho máximo da resposta</Label>
                  <Input
                    type="number"
                    step="1"
                    min={64}
                    max={4096}
                    value={formState.config.max_tokens}
                    onChange={(e) => patchConfig({ max_tokens: Number(e.target.value) })}
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Mensagens de contexto (1–50)</Label>
                  <Input
                    type="number"
                    step="1"
                    min={1}
                    max={50}
                    value={formState.config.context_message_window}
                    onChange={(e) =>
                      patchConfig({ context_message_window: Number(e.target.value) })
                    }
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Busca no conhecimento</h3>
              <p className="text-xs text-muted-foreground">
                Quantos trechos buscar e quão parecidos precisam ser. Não é a tela do dia
                a dia.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Trechos a buscar (1–20)</Label>
                  <Input
                    type="number"
                    step="1"
                    min={1}
                    max={20}
                    value={formState.config.rag_top_k}
                    onChange={(e) => patchConfig({ rag_top_k: Number(e.target.value) })}
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Semelhança mínima (0–1)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    value={formState.config.rag_similarity_threshold}
                    onChange={(e) =>
                      patchConfig({ rag_similarity_threshold: Number(e.target.value) })
                    }
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Quando pedir uma pessoa (0–1)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    value={formState.config.confidence_threshold}
                    onChange={(e) =>
                      patchConfig({ confidence_threshold: Number(e.target.value) })
                    }
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2" data-testid="regras-tecnicas">
              <h3 className="text-sm font-semibold">Regras técnicas</h3>
              <p className="text-xs text-muted-foreground">
                Bloqueios extras. A maioria das locadoras não precisa disto.
              </p>
              <GuardrailsEditor
                value={formState.guardrails}
                onChange={(v) => patchForm({ guardrails: v })}
                disabled={disabled}
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
