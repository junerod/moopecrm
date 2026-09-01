"use client";

/**
 * Pergunta do pareamento: o chip já atende ou é novo?
 * A resposta vai para channel_knobs — sem ela o motor assume 20/dia.
 */
export function PerguntaIdadeDoNumero({
  valor,
  onEscolher,
}: {
  valor: boolean | null;
  onEscolher: (jaEmUso: boolean) => void;
}) {
  return (
    <fieldset className="space-y-3" data-testid="pergunta-idade-do-numero">
      <legend className="text-sm font-medium">Esse número já atende clientes?</legend>
      <p className="text-xs text-muted-foreground">
        Número com anos de conversa já está pronto. Número novo (chip de ontem) precisa
        começar devagar, senão o WhatsApp bloqueia.
      </p>
      <div className="grid gap-2">
        <Opcao
          testid="idade-ja-em-uso"
          marcada={valor === true}
          titulo="Sim — já uso este número há tempo"
          corpo="Cobra, avisa e conversa como hoje. Sem limite de 20 por dia."
          onEscolher={() => onEscolher(true)}
        />
        <Opcao
          testid="idade-numero-novo"
          marcada={valor === false}
          titulo="Não — é um número novo"
          corpo="Começa com pouco por dia e sobe sozinho nas primeiras semanas."
          onEscolher={() => onEscolher(false)}
        />
      </div>
    </fieldset>
  );
}

function Opcao({
  testid,
  marcada,
  titulo,
  corpo,
  onEscolher,
}: {
  testid: string;
  marcada: boolean;
  titulo: string;
  corpo: string;
  onEscolher: () => void;
}) {
  return (
    <label
      data-testid={testid}
      data-marcada={marcada ? "sim" : "nao"}
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
        marcada ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
      }`}
    >
      <input
        type="radio"
        name="idade-do-numero"
        checked={marcada}
        onChange={onEscolher}
        className="mt-1 h-4 w-4 shrink-0 accent-primary"
        aria-label={titulo}
      />
      <span className="space-y-1">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{corpo}</span>
      </span>
    </label>
  );
}
