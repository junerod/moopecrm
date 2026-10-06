"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROTULO_DA_FONTE, type FonteDeConsulta, type NodeType } from "@/lib/followup/graph-schema";
import { NODE_VISUAL_LIST } from "./nodes/nodeVisuals";

interface Props {
  onAdd: (type: NodeType) => void;
  onAddConsulta?: (fonte: FonteDeConsulta) => void;
  onCriarMenu?: () => void;
  /** "mobile" = mesmo conteúdo dentro do Sheet que `FlowCanvas` abre abaixo de
   * `lg` — a barra fixa de 224px não cabia perto do canvas num celular. */
  variant?: "desktop" | "mobile";
}

const MIME_FONTE = "application/x-followup-consulta-fonte";

const GRUPOS: { titulo: string; tipos: NodeType[] }[] = [
  { titulo: "Conversar", tipos: ["trigger", "menu", "faq", "action", "wait", "horario"] },
  { titulo: "Decidir", tipos: ["condition", "ai_classify"] },
  { titulo: "Encerrar", tipos: ["assistente", "humano", "end"] },
];

const MOOPE: { fonte: FonteDeConsulta; detalhe: string; classe: string }[] = [
  { fonte: "cliente", detalhe: "Nome e contrato deste telefone", classe: "border-l-indigo-600 bg-indigo-50" },
  { fonte: "oferta", detalhe: "Carros e preços da página", classe: "border-l-sky-600 bg-sky-50" },
  { fonte: "boleto", detalhe: "Link da segunda via", classe: "border-l-emerald-600 bg-emerald-50" },
  { fonte: "financeiro", detalhe: "Parcelas e atraso", classe: "border-l-amber-500 bg-amber-50" },
  { fonte: "situacao", detalhe: "Veículo, placa e contrato", classe: "border-l-cyan-600 bg-cyan-50" },
  { fonte: "investidor", detalhe: "Nome e portal do investidor", classe: "border-l-teal-600 bg-teal-50" },
];

/** Sidebar palette — click to add. Native HTML5 drag-and-drop wired in FlowCanvas. */
export function NodePalette({ onAdd, onAddConsulta, onCriarMenu, variant = "desktop" }: Props) {
  const isMobile = variant === "mobile";
  const porTipo = new Map(NODE_VISUAL_LIST.map((v) => [v.type, v]));

  return (
    <aside
      className={cn(
        "flex flex-col gap-1.5 overflow-y-auto p-3",
        isMobile
          ? "h-full w-full"
          : "hidden w-64 shrink-0 border-r border-border bg-surface lg:flex",
      )}
      data-testid="node-palette"
    >
      <h2 className="px-1 pb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
        Componentes
      </h2>
      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo} className="space-y-1">
          <p className="px-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            {grupo.titulo}
          </p>
          {grupo.tipos.map((type) => {
            const visual = porTipo.get(type);
            if (!visual) return null;
            const Icon = visual.icon;
            return (
              <span key={type} className="contents">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={cn(
                    "h-auto justify-start gap-2 border-l-4 bg-white/80 py-2 dark:bg-transparent",
                    visual.borderClassName,
                    visual.washClassName,
                  )}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-followup-node-type", visual.type);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onAdd(visual.type)}
                  data-testid={`palette-add-${visual.type}`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${visual.chipClassName}`}
                  >
                    <Icon size={14} aria-hidden />
                  </span>
                  <span className="text-left leading-tight">
                    {visual.paletteLabel}
                    {type === "assistente" ? (
                      <span className="block text-[10px] font-normal text-text-muted">
                        Escolhe um já criado
                      </span>
                    ) : null}
                  </span>
                </Button>
                {visual.type === "menu" && onCriarMenu ? (
                  <Button
                    type="button"
                    size="sm"
                    className="justify-start bg-gradient-to-r from-sky-600 to-emerald-600 text-white hover:from-sky-700 hover:to-emerald-700"
                    onClick={onCriarMenu}
                    data-testid="criar-modelo-menu"
                  >
                    Modelos prontos
                  </Button>
                ) : null}
              </span>
            );
          })}
        </div>
      ))}

      <div className="space-y-1">
        <p className="px-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
          Moope
        </p>
        <p className="px-1 pb-1 text-[11px] leading-snug text-text-muted">
          Cada um manda só o que a gestão devolver. Sem dado, ligue a saída Não encontrou.
        </p>
        {MOOPE.map((bloco) => (
          <Button
            key={bloco.fonte}
            type="button"
            variant="secondary"
            size="sm"
            className={cn("h-auto justify-start border-l-4 py-2 text-left dark:bg-transparent", bloco.classe)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(MIME_FONTE, bloco.fonte);
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => onAddConsulta?.(bloco.fonte)}
            data-testid={`palette-consulta-${bloco.fonte}`}
          >
            <span className="leading-tight">
              {ROTULO_DA_FONTE[bloco.fonte]}
              <span className="block text-[10px] font-normal text-text-muted">{bloco.detalhe}</span>
            </span>
          </Button>
        ))}
      </div>
    </aside>
  );
}

export { MIME_FONTE };
