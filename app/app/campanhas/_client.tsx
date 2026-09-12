"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCampanhas,
  useCancelarCampanha,
  useCriarCampanha,
  useEstimativaSegmento,
  useIniciarCampanha,
} from "@/hooks/campanhas/useCampanhas";
import { previewDaCampanha } from "@/lib/campanhas/preview";
import type { SegmentoDaCampanha } from "@/lib/campanhas/tipos";

const PASSOS = ["Quem receberá", "Mensagem", "Revisar", "Enviar"] as const;

export function CampanhasClient({ podeEnviar }: { podeEnviar: boolean }) {
  const lista = useCampanhas();
  const criar = useCriarCampanha();
  const iniciar = useIniciarCampanha();
  const cancelar = useCancelarCampanha();
  const [wizard, setWizard] = useState(false);
  const [passo, setPasso] = useState(0);
  const [nome, setNome] = useState("Campanha comercial");
  const [tag, setTag] = useState("");
  const [papel, setPapel] = useState("");
  const [origem, setOrigem] = useState("");
  const [body, setBody] = useState("Olá {{nome}}, sua proposta está pronta.");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);

  const segmento: SegmentoDaCampanha = useMemo(() => {
    const s: SegmentoDaCampanha = {};
    if (tag.trim()) s.tags = [tag.trim()];
    if (papel.trim()) s.papel = papel.trim();
    if (origem.trim()) s.origem = origem.trim();
    return s;
  }, [tag, papel, origem]);

  const estimativa = useEstimativaSegmento(segmento, wizard && passo === 0);
  const preview = previewDaCampanha({
    template: body,
    valores: { nome: "Maria", telefone: "+5511999990000", email: "maria@exemplo.com" },
  });

  async function disparar() {
    const id =
      rascunhoId ??
      (
        await criar.mutateAsync({
          name: nome.trim() || "Campanha comercial",
          body_text: body,
          segment: segmento,
        })
      ).id;
    await iniciar.mutateAsync(id);
    setDetalheId(id);
    setWizard(false);
    setPasso(0);
    setRascunhoId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {podeEnviar
            ? "Manager e admin criam e disparam. O envio desta rodada é simulado."
            : "Você pode consultar campanhas. Envio é de manager/admin."}
        </p>
        {podeEnviar ? (
          <Button data-testid="campanha-nova" onClick={() => setWizard(true)}>
            Nova campanha
          </Button>
        ) : null}
      </div>

      {wizard ? (
        <div className="rounded-lg border border-border p-4" data-testid="campanha-wizard">
          <ol className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {PASSOS.map((p, i) => (
              <li key={p} className={i === passo ? "font-medium text-foreground" : ""}>
                {i + 1}. {p}
              </li>
            ))}
          </ol>

          {passo === 0 ? (
            <div className="grid gap-3 md:grid-cols-3" data-testid="campanha-passo-segmento">
              <div>
                <Label htmlFor="camp-tag">Tag</Label>
                <Input id="camp-tag" value={tag} onChange={(e) => setTag(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="camp-papel">Papel</Label>
                <Input id="camp-papel" value={papel} onChange={(e) => setPapel(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="camp-origem">Origem</Label>
                <Input id="camp-origem" value={origem} onChange={(e) => setOrigem(e.target.value)} />
              </div>
              <p className="md:col-span-3 text-sm" data-testid="campanha-estimativa">
                {estimativa.data?.rotulo ?? "Estimando…"}
                {estimativa.data && estimativa.data.excluidos > 0
                  ? ` · ${estimativa.data.excluidos} excluídos (bloqueados/opt-out)`
                  : ""}
              </p>
            </div>
          ) : null}

          {passo === 1 ? (
            <div className="grid gap-3" data-testid="campanha-passo-mensagem">
              <div>
                <Label htmlFor="camp-nome">Nome da campanha</Label>
                <Input id="camp-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="camp-body">Mensagem</Label>
                <textarea
                  id="camp-body"
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {passo >= 2 ? (
            <div className="space-y-3" data-testid="campanha-passo-revisar">
              <p className="text-sm text-muted-foreground">{estimativa.data?.rotulo}</p>
              <blockquote
                className="rounded-md bg-muted p-3 text-sm"
                data-testid="campanha-preview"
                data-ok={preview.ok ? "1" : "0"}
              >
                {preview.texto}
              </blockquote>
              {!preview.ok ? (
                <p className="text-sm text-destructive">
                  {preview.desconhecidas.length
                    ? `Variável desconhecida: ${preview.desconhecidas.join(", ")}`
                    : `Falta valor: ${preview.faltando.join(", ")}`}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => (passo === 0 ? setWizard(false) : setPasso(passo - 1))}>
              {passo === 0 ? "Cancelar" : "Voltar"}
            </Button>
            {passo >= 1 ? (
              <Button
                variant="outline"
                data-testid="campanha-salvar-rascunho"
                disabled={criar.isPending}
                onClick={() =>
                  void criar
                    .mutateAsync({
                      name: nome.trim() || "Campanha comercial",
                      body_text: body,
                      segment: segmento,
                    })
                    .then((c) => setRascunhoId(c.id))
                }
              >
                Salvar rascunho
              </Button>
            ) : null}
            {passo < 3 ? (
              <Button data-testid="campanha-proximo" onClick={() => setPasso(passo + 1)}>
                Continuar
              </Button>
            ) : (
              <Button
                data-testid="campanha-enviar"
                disabled={!preview.ok || criar.isPending || iniciar.isPending}
                onClick={() => void disparar()}
              >
                Enviar agora
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <ul className="divide-y rounded-lg border border-border" data-testid="campanhas-lista">
        {(lista.data ?? []).length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">Nenhuma campanha ainda.</li>
        ) : (
          (lista.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <Link href={`/app/campanhas/${c.id}`} className="text-sm font-medium hover:underline">
                  {c.name}
                </Link>
                <p className="text-xs text-muted-foreground">{c.status}</p>
              </div>
              {podeEnviar && (c.status === "running" || c.status === "scheduled") ? (
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`campanha-cancelar-${c.id}`}
                  onClick={() => cancelar.mutate(c.id)}
                >
                  Cancelar
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {detalheId ? (
        <p className="text-sm">
          Campanha criada.{" "}
          <Link className="underline" href={`/app/campanhas/${detalheId}`}>
            Ver resultado
          </Link>
        </p>
      ) : null}
    </div>
  );
}
