"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  opcoesPadrao,
  type DestinoDaOpcao,
  type OpcaoDoModelo,
} from "@/lib/followup/modelo-de-menu";
import { cn } from "@/lib/utils";

const DESTINOS: { id: DestinoDaOpcao; titulo: string; explica: string; classe: string }[] = [
  {
    id: "texto",
    titulo: "Responder um texto",
    explica: "Sai a frase que você escrever, do jeito que está.",
    classe: "border-sky-500/40 bg-sky-500/10",
  },
  {
    id: "humano",
    titulo: "Chamar uma pessoa",
    explica: "Avisa o cliente e o bot para. Alguém da equipe assume.",
    classe: "border-emerald-500/40 bg-emerald-500/10",
  },
  {
    id: "assistente",
    titulo: "Deixar o assistente",
    explica: "A conversa segue com o assistente de inteligência artificial.",
    classe: "border-violet-500/40 bg-violet-500/10",
  },
];

export function WizardMenu({
  open,
  onOpenChange,
  onCriar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriar: (entrada: { titulo: string; opcoes: OpcaoDoModelo[] }) => void;
}) {
  const [passo, setPasso] = useState(0);
  const [titulo, setTitulo] = useState("Como posso ajudar?");
  const [opcoes, setOpcoes] = useState<OpcaoDoModelo[]>(() => opcoesPadrao(3));
  const [erro, setErro] = useState<string | null>(null);

  const total = 4 + opcoes.length;
  const indiceOpcao = passo - 3;
  const opcaoAtual = indiceOpcao >= 0 && indiceOpcao < opcoes.length ? opcoes[indiceOpcao] : null;
  const revisao = passo === 3 + opcoes.length;

  const resumo = useMemo(
    () =>
      opcoes
        .map((o) => `${o.numero} ${o.rotulo}`)
        .join(" · "),
    [opcoes],
  );

  function fechar(next: boolean) {
    if (!next) {
      setPasso(0);
      setErro(null);
    }
    onOpenChange(next);
  }

  function definirQuantidade(n: number) {
    setOpcoes((atual) => {
      const base = opcoesPadrao(n);
      return base.map((padrao, i) => atual[i] ?? padrao);
    });
  }

  function mudarOpcao(patch: Partial<OpcaoDoModelo>) {
    setOpcoes((atual) => atual.map((o, i) => (i === indiceOpcao ? { ...o, ...patch } : o)));
  }

  function avancar() {
    setErro(null);
    if (passo === 1 && titulo.trim().length === 0) {
      setErro("Dê um nome. É o que a pessoa lê no WhatsApp.");
      return;
    }
    if (opcaoAtual) {
      if (opcaoAtual.rotulo.trim().length === 0) {
        setErro("Escreva o que aparece nessa opção. Exemplo: Horário.");
        return;
      }
      if (opcaoAtual.destino === "texto" && opcaoAtual.texto.trim().length === 0) {
        setErro("Escreva a resposta. É a frase que sai no WhatsApp.");
        return;
      }
    }
    if (revisao) {
      onCriar({ titulo: titulo.trim(), opcoes });
      fechar(false);
      return;
    }
    setPasso((p) => p + 1);
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0" data-testid="wizard-menu">
        <div
          aria-hidden
          className="h-1.5 w-full bg-muted"
        >
          <div
            className="h-full bg-gradient-to-r from-sky-500 via-emerald-500 to-violet-500 transition-all"
            style={{ width: `${((passo + 1) / total) * 100}%` }}
          />
        </div>
        <div className="space-y-4 p-6">
          <DialogHeader>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Passo {passo + 1} de {total}
            </p>
            <DialogTitle>
              {passo === 0 && "Montar o menu 1, 2, 3"}
              {passo === 1 && "Como o menu se chama?"}
              {passo === 2 && "Quantas opções?"}
              {opcaoAtual && `Opção ${opcaoAtual.numero}`}
              {revisao && "Pronto para colocar no quadro"}
            </DialogTitle>
            <DialogDescription>
              {passo === 0 &&
                "A gente desenha o menu e liga cada número. Depois você só muda o texto — bem mais fácil do que começar do zero."}
              {passo === 1 && "Essa frase é a primeira coisa que a pessoa vê no WhatsApp."}
              {passo === 2 && "O número entra sozinho: 1, 2, 3. Você escolhe só a quantidade."}
              {opcaoAtual && "O que a pessoa lê, e o que acontece quando ela escolhe."}
              {revisao && resumo}
            </DialogDescription>
          </DialogHeader>

          {passo === 0 ? (
            <ol className="space-y-2 text-sm">
              <li className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2">1. Nome do menu</li>
              <li className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">2. Quantas opções</li>
              <li className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2">
                3. Cada opção: texto, pessoa ou assistente
              </li>
            </ol>
          ) : null}

          {passo === 1 ? (
            <div className="space-y-2">
              <Label htmlFor="wizard-titulo">Frase do menu</Label>
              <Input
                id="wizard-titulo"
                value={titulo}
                maxLength={200}
                onChange={(e) => setTitulo(e.target.value)}
                data-testid="wizard-titulo"
              />
            </div>
          ) : null}

          {passo === 2 ? (
            <div className="grid grid-cols-5 gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  data-testid={`wizard-qtd-${n}`}
                  onClick={() => definirQuantidade(n)}
                  className={cn(
                    "rounded-xl border py-3 text-lg font-semibold",
                    opcoes.length === n
                      ? "border-sky-500 bg-sky-500/15 text-sky-800 dark:text-sky-200"
                      : "border-border bg-background",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          ) : null}

          {opcaoAtual ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="wizard-rotulo">Texto da opção {opcaoAtual.numero}</Label>
                <Input
                  id="wizard-rotulo"
                  value={opcaoAtual.rotulo}
                  maxLength={80}
                  onChange={(e) => mudarOpcao({ rotulo: e.target.value })}
                  data-testid="wizard-rotulo"
                />
                <p className="text-xs text-muted-foreground">No WhatsApp aparece: {opcaoAtual.numero}. {opcaoAtual.rotulo || "…"}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Quando a pessoa escolher</p>
                <div className="grid gap-2">
                  {DESTINOS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      data-testid={`wizard-destino-${d.id}`}
                      onClick={() => mudarOpcao({ destino: d.id })}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left",
                        opcaoAtual.destino === d.id ? d.classe : "border-border",
                      )}
                    >
                      <span className="block text-sm font-medium">{d.titulo}</span>
                      <span className="block text-xs text-muted-foreground">{d.explica}</span>
                    </button>
                  ))}
                </div>
              </div>
              {opcaoAtual.destino !== "assistente" ? (
                <div className="space-y-2">
                  <Label htmlFor="wizard-texto">
                    {opcaoAtual.destino === "humano" ? "O que dizer ao passar" : "Resposta que sai"}
                  </Label>
                  <Textarea
                    id="wizard-texto"
                    value={opcaoAtual.texto}
                    maxLength={opcaoAtual.destino === "humano" ? 500 : 1000}
                    onChange={(e) => mudarOpcao({ texto: e.target.value })}
                    data-testid="wizard-texto"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {revisao ? (
            <ul className="space-y-2 text-sm">
              {opcoes.map((o) => (
                <li key={o.numero} className="rounded-xl border border-border px-3 py-2">
                  <span className="font-semibold">{o.numero}. {o.rotulo}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {DESTINOS.find((d) => d.id === o.destino)?.titulo}
                    {o.destino !== "assistente" && o.texto ? ` — ${o.texto}` : ""}
                  </span>
                </li>
              ))}
              <li className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
                Se a pessoa não digitar um número, o bot passa para uma pessoa. Isso já entra no quadro.
              </li>
            </ul>
          ) : null}

          {erro ? <p className="text-sm text-red-600 dark:text-red-400">{erro}</p> : null}

          <DialogFooter className="gap-2 sm:gap-2">
            {passo > 0 ? (
              <Button type="button" variant="outline" onClick={() => { setErro(null); setPasso((p) => p - 1); }}>
                Voltar
              </Button>
            ) : null}
            <Button type="button" onClick={avancar} data-testid="wizard-avancar">
              {passo === 0 ? "Começar" : revisao ? "Criar no quadro" : "Continuar"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
