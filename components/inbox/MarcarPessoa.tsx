"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMarcarPapel } from "@/hooks/inbox/useMarcarPapel";
import {
  DICA_DO_PAPEL,
  PAPEIS_DO_CONTATO,
  ROTULO_DO_PAPEL,
  ehPapelDoContato,
} from "@/lib/crm/papel-e-temperatura";
import { cn } from "@/lib/utils";

interface Props {
  contactId: string;
  papel: string | null | undefined;
  contactName: string;
}

export function MarcarPessoa({ contactId, papel, contactName }: Props) {
  const { marcar, isPending } = useMarcarPapel(contactId);
  const atual = ehPapelDoContato(papel) ? papel : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={atual ? "default" : "outline"}
          disabled={isPending}
          data-testid="marcar-pessoa"
          title="Diz se esta conversa é lead, cliente, equipe ou para ignorar."
        >
          {atual ? ROTULO_DO_PAPEL[atual] : "Marcar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2 p-3" data-testid="marcar-pessoa-opcoes">
        <p className="text-xs text-muted-foreground">
          Marca quem é esta pessoa. Evita o automático tratar cliente ou equipe
          como lead novo.
        </p>
        <div className="grid gap-1.5">
          {PAPEIS_DO_CONTATO.map((p) => {
            const ativo = atual === p;
            return (
              <button
                key={p}
                type="button"
                disabled={isPending}
                data-testid={`marcar-pessoa-${p}`}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
                  ativo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted",
                )}
                onClick={() => void marcar(p, { atual: papel, contactName })}
              >
                <div className="font-medium">{ROTULO_DO_PAPEL[p]}</div>
                <div className={cn("text-[11px]", ativo ? "opacity-90" : "text-muted-foreground")}>
                  {DICA_DO_PAPEL[p]}
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
