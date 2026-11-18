"use client";

import Link from "next/link";

import {
  EXEMPLO_DE_PESSOA,
  EXEMPLOS_DE_PERGUNTA,
  PASSO_ASSISTENTE,
  PASSO_CONEXAO,
  PASSO_CREDENCIAL,
  PASSO_FILA,
  PASSO_HUMANO,
  PORTA_ASSISTENTE,
  PORTA_BOT,
  explicacaoDaFerramenta,
  ferramentasForaDoExemplo,
  ferramentasSoDoAtendente,
  rotuloDaFerramenta,
  rotuloVisivel,
  type ExemploDePergunta,
  type PassoDaTela,
} from "@/lib/moope/guia-integracao";
import { ROTULO_DA_FONTE } from "@/lib/followup/graph-schema";

const TOM: Record<ExemploDePergunta["tom"], string> = {
  emerald: "border-emerald-500/40 bg-emerald-500/10",
  sky: "border-sky-500/40 bg-sky-500/10",
  amber: "border-amber-500/40 bg-amber-500/10",
  violet: "border-violet-500/40 bg-violet-500/10",
  orange: "border-orange-500/40 bg-orange-500/10",
  teal: "border-teal-500/40 bg-teal-500/10",
};

function Caminho({ passos }: { passos: string }) {
  const partes = passos.split(" → ");
  return (
    <ol className="flex flex-wrap items-center gap-1">
      {partes.map((parte, i) => (
        <li key={`${parte}-${i}`} className="flex items-center gap-1">
          {i > 0 ? <span className="text-xs text-muted-foreground">→</span> : null}
          <span className="rounded-full bg-[var(--moope-primary-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--moope-primary)]">
            {parte}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Janela({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="flex items-center gap-1.5 border-b bg-muted/70 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-rose-400" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="ml-2 truncate text-[11px] font-medium text-muted-foreground">{titulo}</span>
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </div>
  );
}

function Bolha({ quem, texto }: { quem: "cliente" | "resposta"; texto: string }) {
  const cliente = quem === "cliente";
  return (
    <div className={cliente ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          cliente
            ? "max-w-[90%] rounded-2xl rounded-br-md bg-[var(--moope-primary)] px-3 py-2 text-sm text-white"
            : "max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm"
        }
      >
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
          {cliente ? "Cliente no WhatsApp" : "O que pode sair"}
        </p>
        {texto}
      </div>
    </div>
  );
}

function Mapa({ passo, fonte }: { passo: PassoDaTela; fonte?: ExemploDePergunta["fonte"] }) {
  return (
    <Janela titulo={passo.tituloDaJanela}>
      <Caminho passos={passo.menu} />
      {fonte ? (
        <div className="rounded-lg border border-dashed border-border p-2">
          <p className="text-[11px] font-medium">O que consultar na gestão</p>
          <p className="mt-1 rounded-md bg-[var(--moope-primary-bg)] px-2 py-1 text-xs font-semibold text-[var(--moope-primary)]">
            {rotuloVisivel(fonte)}
          </p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
            {Object.values(ROTULO_DA_FONTE)
              .filter((rotulo) => rotulo !== rotuloVisivel(fonte))
              .slice(0, 2)
              .map((rotulo) => (
                <li key={rotulo}>○ {rotulo}</li>
              ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs leading-relaxed text-muted-foreground">{passo.oQueClicar}</p>
      <Link href={passo.href} className="inline-block text-xs font-medium text-[var(--moope-primary)] underline">
        Abrir esta tela
      </Link>
    </Janela>
  );
}

export function GuiaIntegracaoMoope() {
  const oferta = EXEMPLOS_DE_PERGUNTA.find((e) => e.id === "oferta");
  const resto = EXEMPLOS_DE_PERGUNTA.filter((e) => e.id !== "oferta");
  const soAtendente = ferramentasSoDoAtendente();
  const fora = ferramentasForaDoExemplo();

  return (
    <div className="space-y-6" data-testid="guia-integracao-moope">
      <section className="rounded-2xl border border-[color-mix(in_srgb,var(--moope-primary)_28%,transparent)] bg-[var(--moope-primary-bg)] p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--moope-primary)]">
          Onde a gestão entra na conversa
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">
          O cliente pergunta. A resposta sai da Moope, por um destes dois caminhos.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Os dois leem a mesma conexão desta tela. O cliente continua no WhatsApp de
          onde escreveu. Se a gestão não responder, ninguém inventa preço, placa ou lista.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Porta
            kicker="Sem chave de IA"
            titulo={PORTA_BOT.titulo}
            texto={PORTA_BOT.resumo}
            menu={PORTA_BOT.menu}
            href={PORTA_BOT.href}
            teste="porta-bot"
          />
          <Porta
            kicker="Pergunta livre"
            titulo={PORTA_ASSISTENTE.titulo}
            texto={PORTA_ASSISTENTE.resumo}
            menu={PORTA_ASSISTENTE.menu}
            href={PORTA_ASSISTENTE.href}
            teste="porta-assistente"
          />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Mapa passo={PASSO_CONEXAO} />
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            A chave de IA é da sua empresa
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-950/80 dark:text-amber-100/80">
            O bot de menu não pensa: ele só repete o que a gestão devolveu. O assistente
            pensa, e o gasto da inteligência sai da chave que você cola em Credenciais.
            Assim a instalação não paga o token de cada cliente.
          </p>
          <div className="mt-3">
            <Mapa passo={PASSO_CREDENCIAL} />
          </div>
        </div>
      </section>

      {oferta ? (
        <section className={`space-y-4 rounded-2xl border p-5 ${TOM[oferta.tom]}`} data-testid="exemplo-oferta">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide">Exemplo completo</p>
            <h3 className="text-base font-semibold">{oferta.titulo}</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 rounded-xl bg-background/80 p-3">
              <Bolha quem="cliente" texto={oferta.pergunta} />
              <Bolha quem="resposta" texto={oferta.resposta} />
              <p className="text-[11px] text-muted-foreground">
                Números de exemplo. No WhatsApp real só entra linha que a gestão devolver.
              </p>
            </div>
            <div className="space-y-3">
              <Mapa passo={oferta.passo} fonte={oferta.fonte} />
              <Mapa passo={PASSO_ASSISTENTE} />
            </div>
          </div>
          <p className="text-sm leading-relaxed">{oferta.limite}</p>
          <p className="text-sm leading-relaxed">
            No assistente, a ferramenta é «{rotuloDaFerramenta(oferta.ferramenta ?? "")}».
            Ele lista os itens que a gestão mandar. Carro com tarja alugado: avisa e oferece
            chamar a equipe quando liberar. Não fecha reserva.
          </p>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2">
        {resto.map((exemplo) => (
          <article
            key={exemplo.id}
            className={`space-y-3 rounded-2xl border p-4 ${TOM[exemplo.tom]}`}
            data-testid={`exemplo-${exemplo.id}`}
          >
            <h3 className="text-sm font-semibold">{exemplo.titulo}</h3>
            <p className="text-xs font-medium">
              {rotuloVisivel(exemplo.fonte!)} · {rotuloDaFerramenta(exemplo.ferramenta!)}
              {exemplo.acompanha?.map((nome) => ` · ${rotuloDaFerramenta(nome)}`)}
            </p>
            <Bolha quem="cliente" texto={exemplo.pergunta} />
            <Bolha quem="resposta" texto={exemplo.resposta} />
            <Mapa passo={exemplo.passo} fonte={exemplo.fonte} />
            <p className="text-xs leading-relaxed">{exemplo.limite}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-2" data-testid="exemplo-pessoa">
        <div className="space-y-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
          <h3 className="text-sm font-semibold">{EXEMPLO_DE_PESSOA.titulo}</h3>
          <Bolha quem="cliente" texto={EXEMPLO_DE_PESSOA.pergunta} />
          <Bolha quem="resposta" texto={EXEMPLO_DE_PESSOA.resposta} />
          <p className="text-xs leading-relaxed">{EXEMPLO_DE_PESSOA.limite}</p>
        </div>
        <div className="space-y-3">
          <Mapa passo={PASSO_HUMANO} />
          <Janela titulo={PASSO_FILA.tituloDaJanela}>
            <Caminho passos={PASSO_FILA.menu} />
            <p className="rounded-md border border-dashed px-2 py-1 text-xs">
              Como distribuir: <span className="font-semibold">Rodízio entre quem está disponível</span>
            </p>
            <p className="text-xs text-muted-foreground">{PASSO_FILA.oQueClicar}</p>
            <Link href={PASSO_FILA.href} className="text-xs font-medium text-[var(--moope-primary)] underline">
              Abrir esta tela
            </Link>
          </Janela>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border p-4" data-testid="so-atendente">
        <h3 className="text-sm font-semibold">O atendente consulta. O cliente não ouve isto sozinho.</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          No assistente, a aba «Organiza o sistema» guarda consultas para quem está na
          conversa por dentro. Elas não saem no WhatsApp até alguém também ligá-las em
          «Conversa com o cliente → 4. O que faz».
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {soAtendente.map((nome) => (
            <li key={nome} className="rounded-lg bg-muted/60 p-3 text-sm">
              <p className="font-medium">{rotuloDaFerramenta(nome)}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{explicacaoDaFerramenta(nome)}</p>
              {nome === "moope_consultar_disponibilidade" ? (
                <p className="mt-2 text-xs leading-relaxed">
                  Responde sim ou não, mais um preço, para as datas pedidas. Não devolve quantos
                  carros cabem 5 pessoas nem o dia em que um alugado volta.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {fora.length > 0 ? (
          <div className="rounded-lg border border-dashed p-3">
            <p className="text-xs font-medium">Existem na gestão e ainda não vêm ligadas no exemplo</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {fora.map((nome) => (
                <li key={nome}>
                  <span className="font-medium text-foreground">{rotuloDaFerramenta(nome)}.</span>{" "}
                  {explicacaoDaFerramenta(nome)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Porta({
  kicker,
  titulo,
  texto,
  menu,
  href,
  teste,
}: {
  kicker: string;
  titulo: string;
  texto: string;
  menu: string;
  href: string;
  teste: string;
}) {
  return (
    <div className="rounded-xl bg-background/90 p-4 shadow-sm" data-testid={teste}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--moope-primary)]">{kicker}</p>
      <h3 className="mt-1 text-sm font-semibold">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{texto}</p>
      <div className="mt-3">
        <Caminho passos={menu} />
      </div>
      <Link href={href} className="mt-3 inline-block text-xs font-medium text-[var(--moope-primary)] underline">
        Abrir
      </Link>
    </div>
  );
}
