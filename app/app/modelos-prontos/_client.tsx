"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CENARIOS_TEST_DRIVE } from "@/lib/business-packs/test-drive";
import type { BusinessPackGravado } from "@/lib/business-packs/tipos";
import { cn } from "@/lib/utils";

type Capacidade = {
  key: string;
  label: string;
  disponivel: boolean;
  motivo?: string;
};

type ResultadoTeste = {
  intent: string;
  specialty_name: string;
  knowledge_hint: string;
  tool_que_seria_chamada: string | null;
  resposta: string;
  precisa_humano: boolean;
  gestao_necessaria: boolean;
};

const CARDS_MODELOS = [
  { id: "recepcao", titulo: "Atendimento da locadora", especialidade: "recepcao" },
  { id: "financeiro", titulo: "Financeiro e boletos", especialidade: "financeiro" },
  { id: "disponibilidade", titulo: "Disponibilidade e locação", especialidade: "disponibilidade" },
  { id: "atendimento", titulo: "Atendimento durante a locação", especialidade: "atendimento" },
  { id: "comercial", titulo: "Comercial e orçamento", especialidade: "comercial" },
  { id: "relacionamento", titulo: "Relacionamento e reativação", especialidade: "relacionamento" },
  { id: "proposta", titulo: "Follow-up de proposta", automacao: "proposta-sem-resposta" },
  { id: "silencio", titulo: "Cliente sem resposta", automacao: "lead-24h" },
  { id: "satisfacao", titulo: "Pesquisa de satisfação", campanha: "Como foi sua experiência?" },
];

export function ModelosProntosClient(props: {
  podeInstalar: boolean;
  catalogo: Array<{ id: string; label: string; description: string; category: string }>;
  instalado: BusinessPackGravado | null;
  definitionLabel: string | null;
  agentes: Array<{ id: string; name: string; is_active: boolean; is_default: boolean }>;
  automacoes: Array<{ id: string; name: string; is_active: boolean }>;
  templates: Array<{ id: string; title: string }>;
  funilNome: string | null;
  etapas: number;
  gestao: "configurado" | "nao_disponivel" | "conectar";
  aiMode: string;
  orgName: string;
  capacidades: Capacidade[];
  specialties: Array<{ key: string; name: string }>;
  automationsDef: Array<{ key: string; name: string; requires_gestao: boolean }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mensagem, setMensagem] = useState(CENARIOS_TEST_DRIVE[0]?.mensagem ?? "");
  const [teste, setTeste] = useState<ResultadoTeste | null>(null);
  const [testando, setTestando] = useState(false);

  function instalar(packId: string) {
    start(async () => {
      const res = await fetch("/api/v1/business-packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack_id: packId }),
      });
      if (!res.ok) {
        toast.error("Não consegui preparar a operação.");
        return;
      }
      toast.success("Operação preparada.");
      router.refresh();
    });
  }

  async function testar() {
    setTestando(true);
    setTeste(null);
    try {
      const res = await fetch("/api/v1/business-packs/test-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem }),
      });
      const json = (await res.json()) as { data?: ResultadoTeste; error?: { message?: string } };
      if (!res.ok || !json.data) {
        toast.error(json.error?.message ?? "Não consegui testar agora.");
        return;
      }
      setTeste(json.data);
    } finally {
      setTestando(false);
    }
  }

  const rotuloGestao =
    props.gestao === "configurado"
      ? "Configurado"
      : props.gestao === "nao_disponivel"
        ? "Não disponível"
        : "Conectar";

  return (
    <div className="space-y-8">
      {props.instalado ? (
        <section className="space-y-3" data-testid="pack-pronto">
          <h2 className="text-lg font-semibold tracking-tight">
            Seu CRM para locadora está pronto
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ResumoCard titulo="Atendimento" valor={`${props.specialties.length} especialidades configuradas`} />
            <ResumoCard titulo="Funil" valor={`${props.etapas} etapas prontas`} />
            <ResumoCard
              titulo="Automações"
              valor={`${props.automationsDef.length} modelos disponíveis`}
            />
            <ResumoCard titulo="Conhecimento" valor="Adicione seus manuais e materiais" href="/app/ai/knowledge/sources" />
            <ResumoCard titulo="WhatsApp" valor="Conectar número" href="/app/connections" />
            <ResumoCard titulo="MOOPE Gestão" valor={rotuloGestao} href="/app/integrations/moope" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/app/ai/knowledge/sources">Começar a configurar</Link>
            </Button>
            {props.podeInstalar ? (
              <Button variant="outline" disabled={pending} onClick={() => instalar(props.instalado!.id)}>
                {pending ? "Reaplicando..." : "Reaplicar sem duplicar"}
              </Button>
            ) : null}
          </div>
          {props.aiMode === "autonomous" ? null : (
            <p className="text-xs text-muted-foreground">
              A IA está em modo seguro ({props.aiMode}). Ela não envia sozinha.
            </p>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Locadoras</h2>
          {props.catalogo.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div>
                <p className="font-medium">{p.label}</p>
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </div>
              {props.podeInstalar ? (
                <Button data-testid="usar-modelo-locadora" disabled={pending} onClick={() => instalar(p.id)}>
                  {pending ? "Preparando..." : "Usar modelo para locadora"}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Peça a quem administra para instalar.</p>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Ensine seus assistentes</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <LinkCard titulo="Manuais e procedimentos" desc="Suporte" href="/app/ai/knowledge/sources" />
          <LinkCard titulo="Preços, apresentação e diferenciais" desc="Comercial" href="/app/ai/knowledge/sources" />
          <LinkCard titulo="Contratos e políticas" desc="Políticas" href="/app/ai/knowledge/sources" />
          <LinkCard titulo="Informações gerais" desc="Geral" href="/app/ai/knowledge/sources" />
        </div>
      </section>

      <section className="space-y-3" data-testid="modelos-prontos-cards">
        <h2 className="text-lg font-semibold tracking-tight">Categoria: Locadoras</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS_MODELOS.map((c) => {
            const ativo = cardAtivo(c, props);
            return (
              <div
                key={c.id}
                className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <p className="font-medium">{c.titulo}</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {ativo ? "Ativo" : "Ativar"}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-2 px-0">
                  <Link href={c.automacao ? "/app/ai/followups" : "/app/ai/agents"}>Personalizar</Link>
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" data-testid="dados-assistentes">
        <h2 className="text-lg font-semibold tracking-tight">Dados que os assistentes podem consultar</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {props.capacidades.map((c) => (
            <li
              key={c.key}
              className="flex items-start gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <span aria-hidden>{c.disponivel ? "✓" : "○"}</span>
              <span>
                <span className="font-medium">{c.label}</span>
                {!c.disponivel && c.motivo ? (
                  <span className="block text-xs text-muted-foreground">{c.motivo}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {props.gestao !== "configurado" ? (
          <p className="text-sm text-muted-foreground">
            Conecte seu sistema de gestão para consultar dados ao vivo.
          </p>
        ) : null}
      </section>

      <section className="space-y-3" data-testid="testar-assistentes">
        <h2 className="text-lg font-semibold tracking-tight">Testar meus assistentes</h2>
        <p className="text-sm text-muted-foreground">
          Sem WhatsApp real. Nada é enviado e nenhuma consulta externa roda.
        </p>
        <div className="flex flex-wrap gap-2">
          {CENARIOS_TEST_DRIVE.map((c) => (
            <Button key={c.id} type="button" variant="outline" size="sm" onClick={() => setMensagem(c.mensagem)}>
              {c.rotulo}
            </Button>
          ))}
        </div>
        <textarea
          data-testid="test-drive-mensagem"
          className="min-h-24 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
        />
        <Button data-testid="test-drive-enviar" disabled={testando || !props.instalado} onClick={() => void testar()}>
          {testando ? "Testando..." : "Testar"}
        </Button>
        {teste ? (
          <div
            data-testid="test-drive-resultado"
            className="space-y-2 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm"
          >
            <p>
              <span className="text-muted-foreground">Intenção:</span> {teste.intent}
            </p>
            <p>
              <span className="text-muted-foreground">Especialidade:</span> {teste.specialty_name}
            </p>
            <p>
              <span className="text-muted-foreground">Conhecimento:</span> {teste.knowledge_hint || "nenhum trecho ainda"}
            </p>
            <p>
              <span className="text-muted-foreground">Consulta que seria feita:</span>{" "}
              {teste.tool_que_seria_chamada ?? "nenhuma"}
            </p>
            <p data-testid="test-drive-resposta">{teste.resposta}</p>
            <p>
              <span className="text-muted-foreground">Precisa de uma pessoa:</span>{" "}
              {teste.precisa_humano ? "sim" : "não"}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ResumoCard({ titulo, valor, href }: { titulo: string; valor: string; href?: string }) {
  const classe =
    "rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-sm font-medium">{valor}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cn(classe, "transition-colors hover:border-[var(--color-accent)]")}>
        {inner}
      </Link>
    );
  }
  return <div className={classe}>{inner}</div>;
}

function LinkCard({ titulo, desc, href }: { titulo: string; desc: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]"
    >
      <p className="font-medium">{titulo}</p>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}

function cardAtivo(
  card: (typeof CARDS_MODELOS)[number],
  props: { agentes: Array<{ name: string }>; automacoes: Array<{ name: string }>; templates: Array<{ title: string }>; specialties: Array<{ key: string }> },
): boolean {
  if (card.especialidade) return props.specialties.some((s) => s.key === card.especialidade);
  if (card.automacao) return props.automacoes.some((a) => a.name.toLowerCase().includes("proposta") || a.name.toLowerCase().includes("24"));
  if (card.campanha) return props.templates.some((t) => t.title === card.campanha);
  return false;
}
