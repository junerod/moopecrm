"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FlowNode } from "@/lib/followup/graph-schema";
import type { RFNode, RFNodeData } from "@/lib/followup/graph-mappers";
import { Trash } from "@/lib/ui/icons";

import { ActionForm } from "./forms/ActionForm";
import { ClassifyForm } from "./forms/ClassifyForm";
import { ConditionForm } from "./forms/ConditionForm";
import { EndForm } from "./forms/EndForm";
import { FaqForm } from "./forms/FaqForm";
import { HumanoForm } from "./forms/HumanoForm";
import { AssistenteForm } from "./forms/AssistenteForm";
import { MenuForm } from "./forms/MenuForm";
import { WaitForm } from "./forms/WaitForm";
import type { ConfigOf } from "./forms/shared";
import { NODE_VISUALS } from "./nodes/nodeVisuals";

interface Props {
  node: RFNode;
  onChange: (patch: Partial<RFNodeData>) => void;
  /** Ramos deste nó que já têm aresta — quem sabe isso é o canvas, que é dono do grafo. */
  ramosLigados?: string[];
  onRemove?: (id: string) => void;
}

/**
 * Casca do formulário de configuração: cabeçalho, rótulo do nó e o formulário
 * do tipo. Cada tipo mora em `forms/` — um arquivo por formulário, para que
 * duas pessoas mexendo em nós diferentes não disputem o mesmo arquivo.
 *
 * A regra que os formulários seguem: o campo só grava no nó vivo (`onChange`)
 * quando o candidato passa no schema — senão mostra erro inline e o canvas
 * mantém a última config válida (nunca um valor pela metade rio acima).
 */
export function NodeConfigPanel({ node, onChange, ramosLigados, onRemove }: Props) {
  const type = node.type as FlowNode["type"];
  const visual = NODE_VISUALS[type];
  const Icon = visual.icon;
  const [label, setLabel] = useState(node.data.label);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const commitLabel = (value: string) => {
    setLabel(value);
    if (value.trim().length < 1 || value.length > 60) {
      setLabelError("Rótulo precisa ter 1 a 60 caracteres.");
      return;
    }
    setLabelError(null);
    onChange({ label: value });
  };

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto" data-testid="node-config-panel">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-base font-semibold text-text">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${visual.chipClassName}`}>
            <Icon size={14} aria-hidden />
          </span>
          {visual.paletteLabel}
        </h2>
        <p className="text-sm text-text-muted">
          Alterações aplicam no rascunho ao digitar — salve na barra de publicação.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="node-label">Rótulo</Label>
        <Input
          id="node-label"
          value={label}
          maxLength={60}
          onChange={(e) => commitLabel(e.target.value)}
        />
        {labelError && <p className="text-xs text-error-fg">{labelError}</p>}
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        {type === "trigger" && (
          <p className="text-sm text-text-muted">
            Início do fluxo — sem configuração adicional. O disparo (manual, mudança de
            etapa, silêncio ou fim de conversa) é definido nas configurações do fluxo.
          </p>
        )}
        {type === "wait" && (
          <WaitForm config={node.data.config as ConfigOf<"wait">} onChange={(config) => onChange({ config })} />
        )}
        {type === "condition" && (
          <ConditionForm
            config={node.data.config as ConfigOf<"condition">}
            onChange={(config) => onChange({ config })}
            ramosLigados={ramosLigados}
          />
        )}
        {type === "ai_classify" && (
          <ClassifyForm
            config={node.data.config as ConfigOf<"ai_classify">}
            onChange={(config) => onChange({ config })}
          />
        )}
        {type === "action" && (
          <ActionForm config={node.data.config as ConfigOf<"action">} onChange={(config) => onChange({ config })} />
        )}
        {type === "end" && (
          <EndForm config={node.data.config as ConfigOf<"end">} onChange={(config) => onChange({ config })} />
        )}
        {type === "menu" && (
          <MenuForm config={node.data.config as ConfigOf<"menu">} onChange={(config) => onChange({ config })} />
        )}
        {type === "faq" && (
          <FaqForm config={node.data.config as ConfigOf<"faq">} onChange={(config) => onChange({ config })} />
        )}
        {type === "horario" && (
          <p className="text-sm text-text-muted">
            Usa o horário de funcionamento do assistente publicado. Dois ramos: dentro e fora.
          </p>
        )}
        {type === "humano" && (
          <HumanoForm
            config={node.data.config as ConfigOf<"humano">}
            onChange={(config) => onChange({ config })}
          />
        )}
        {type === "assistente" && (
          <AssistenteForm
            config={node.data.config as ConfigOf<"assistente">}
            onChange={(config) => onChange({ config })}
          />
        )}
      </div>

      {onRemove ? (
        <div className="mt-auto border-t border-border pt-4">
          {confirmar ? (
            <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm">Tirar este item do quadro? As linhas ligadas a ele saem junto.</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmar(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={() => onRemove(node.id)}
                  data-testid="confirmar-tirar-no"
                >
                  Tirar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-red-600 hover:text-red-700"
              onClick={() => setConfirmar(true)}
              data-testid="tirar-no"
            >
              <Trash size={14} aria-hidden />
              Tirar este item
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
