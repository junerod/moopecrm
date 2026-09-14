"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { PainelDeAjuda } from "@/components/ajuda/PainelDeAjuda";
import { Button } from "@/components/ui/button";
import { cenariosDoPack } from "@/lib/business-packs/test-drive";
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

type AssistenteDoModelo = {
  key: string;
  name: string;
  oQueFaz: string;
  papel: string;
  principal: boolean;
};

type AutomacaoDoModelo = {
  key: string;
  name: string;
  precisaGestao: boolean;
};

export function ModelosProntosClient(props: {
  packLabel: string;
  packDescricao: string;
  packAjudaTitulo: string;
  packAjudaTexto: string;
  packAjudaPassos: string[];
  packAlvoId: string;
  podeInstalar: boolean;
  catalogo: Array<{ id: string; label: string; description: string; category: string }>;
  instalado: BusinessPackGravado | null;
  packAtivo: boolean;
  funilNome: string | null;
  etapas: string[];
  gestao: "configurado" | "nao_disponivel" | "conectar";
  aiMode: string;
  capacidades: Capacidade[];
  assistentes: AssistenteDoModelo[];
  colecoes: Array<{ slug: string; name: string }>;
  automationsDef: AutomacaoDoModelo[];
  respostas: string[];
  campanhas: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmaDesligar, setConfirmaDesligar] = useState(false);
  const packId = props.instalado?.id ?? props.packAlvoId;
  const cenarios = cenariosDoPack(packId);
  const [mensagem, setMensagem] = useState(cenarios[0]?.mensagem ?? "");
  const [teste, setTeste] = useState<ResultadoTeste | null>(null);
  const [testando, setTestando] = useState(false);

  function instalar() {
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

  function mudarEstado(action: "activate" | "deactivate") {
    start(async () => {
      const res = await fetch("/api/v1/business-packs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        toast.error(action === "deactivate" ? "Não consegui desativar o pack." : "Não consegui ativar o pack.");
        return;
      }
      setConfirmaDesligar(false);
      toast.success(action === "deactivate" ? "Pack desativado. Os assistentes do modelo estão desligados." : "Pack ativado.");
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

  const status = !props.instalado ? "ausente" : props.packAtivo ? "ativo" : "inativo";

  return (
    <div className="space-y-8">
      <section className="space-y-4" id="o-que-instala" data-testid="detalhe-do-modelo">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Modelo do seu negócio
            </p>
            <h2 className="text-lg font-semibold tracking-tight">{props.packLabel}</h2>
            {status === "ativo" ? (
              <div data-testid="pack-pronto">
                <p
                  className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
                  data-testid="pack-loja-ativo"
                >
                  ATIVO
                </p>
              </div>
            ) : status === "inativo" ? (
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400" data-testid="pack-loja-inativo">
                DESATIVADO
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Ainda não está ativo nesta empresa.</p>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          São {props.assistentes.length} assistentes prontos, um funil comercial,{" "}
          {props.colecoes.length} coleções de conhecimento, respostas e campanhas. Ativar instala
          o conjunto. Os assistentes ligam. As automações nascem desligadas — você liga cada uma
          depois, se quiser.
        </p>
        <p className="text-sm text-muted-foreground">{props.packDescricao}</p>

        <PainelDeAjuda
          testid={packId === "escritorio_advocacia" ? "advocacia-ajuda" : "locadora-ajuda"}
          titulo={props.packAjudaTitulo}
          texto={props.packAjudaTexto}
          passos={props.packAjudaPassos}
          href="/app/manual"
        />

        <div className="space-y-2" data-testid="modelos-prontos-cards">
          <h3 className="text-sm font-semibold">Os {props.assistentes.length} assistentes</h3>
          <ul
            className="grid gap-3 sm:grid-cols-2"
            data-testid="lista-assistentes-do-modelo"
          >
            {props.assistentes.map((a) => (
              <li
                key={a.key}
                data-testid={`modelo-assistente-${a.key}`}
                className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{a.name}</p>
                  {a.principal ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      Principal
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{a.oQueFaz}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.papel}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Funil</p>
            <p className="mt-1 font-medium">{props.funilNome ?? "Funil comercial"}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
              {props.etapas.map((nome) => (
                <li key={nome}>{nome}</li>
              ))}
            </ol>
          </div>
          <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Conhecimento
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {props.colecoes.map((c) => (
                <li key={c.slug}>{c.name}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Automações
          </p>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="aviso-automacoes-desligadas">
            Prontas e desligadas. Nenhuma dispara sozinha ao ativar o modelo.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {props.automationsDef.map((a) => (
              <li key={a.key} className="flex flex-wrap items-center gap-2">
                <span>{a.name}</span>
                <span className="text-xs text-muted-foreground">desligada</span>
                {a.precisaGestao ? (
                  <span className="text-xs text-muted-foreground">precisa da gestão</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Respostas prontas
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{props.respostas.length} modelos</p>
          </div>
          <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Campanhas
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {props.campanhas.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>

        {status === "ativo" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ResumoCard titulo="WhatsApp" valor="Conectar número" href="/app/connections" />
            <ResumoCard titulo="Sistema de gestão" valor={rotuloGestao} href="/app/integrations/moope" />
            <ResumoCard
              titulo="Conhecimento"
              valor="Adicione seus manuais e materiais"
              href="/app/ai/knowledge/sources"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {status === "ausente" ? (
            props.podeInstalar ? (
              <Button
                data-testid={packId === "escritorio_advocacia" ? "usar-modelo-escritorio_advocacia" : "usar-modelo-locadora"}
                disabled={pending}
                onClick={instalar}
              >
                {pending ? "Preparando..." : "Ativar modelo"}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Peça a quem administra para instalar.</p>
            )
          ) : null}

          {status === "inativo" && props.podeInstalar ? (
            <Button
              data-testid={packId === "escritorio_advocacia" ? "reativar-pack-escritorio_advocacia" : "reativar-pack-locadora"}
              disabled={pending}
              onClick={() => mudarEstado("activate")}
            >
              {pending ? "Ativando..." : "Ativar pack"}
            </Button>
          ) : null}

          {status === "ativo" ? (
            <>
              <Button asChild>
                <Link href="/app/ai/agents">Ver meus assistentes</Link>
              </Button>
              {props.podeInstalar ? (
                <Button variant="outline" disabled={pending} onClick={instalar}>
                  {pending ? "Reaplicando..." : "Reaplicar sem duplicar"}
                </Button>
              ) : null}
            </>
          ) : null}

          {status === "ativo" && props.podeInstalar ? (
            confirmaDesligar ? (
              <div className="w-full rounded-[16px] border border-[var(--color-border)] p-4">
                <p className="text-sm">
                  Desliga os {props.assistentes.length} assistentes do modelo. Funil, conhecimento,
                  respostas e o Assistente da empresa ficam. Nada é apagado.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    data-testid="confirmar-desativar-pack"
                    disabled={pending}
                    onClick={() => mudarEstado("deactivate")}
                  >
                    {pending ? "Desligando..." : "Desligar assistentes"}
                  </Button>
                  <Button variant="ghost" disabled={pending} onClick={() => setConfirmaDesligar(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                data-testid={packId === "escritorio_advocacia" ? "desativar-pack-escritorio_advocacia" : "desativar-pack-locadora"}
                disabled={pending}
                onClick={() => setConfirmaDesligar(true)}
              >
                Desativar pack
              </Button>
            )
          ) : null}
        </div>

        {props.aiMode === "autonomous" ? null : status === "ativo" ? (
          <p className="text-xs text-muted-foreground">
            A IA está em modo seguro. Ela não envia sozinha.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Ensine seus assistentes</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {props.colecoes.map((c) => (
            <LinkCard
              key={c.slug}
              titulo={c.name}
              desc="Adicione documentos desta coleção"
              href="/app/ai/knowledge/sources"
            />
          ))}
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
          {cenarios.map((c) => (
            <Button key={c.id} type="button" variant="outline" size="sm" onClick={() => setMensagem(c.mensagem)}>
              {c.rotulo}
            </Button>
          ))}
        </div>
        <textarea
          data-testid="test-drive-mensagem"
          className="min-h-24 w-full rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm"
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
  const classe = "rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
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
