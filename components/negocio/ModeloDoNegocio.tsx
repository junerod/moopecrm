import Link from "next/link";

import { Button } from "@/components/ui/button";
import { resumoDoPack } from "@/lib/business-packs/apresentacao";
import type { BusinessPackDefinition, BusinessPackGravado } from "@/lib/business-packs/tipos";

export function ModeloDoNegocio({
  pack,
  definition,
  assistentesConfigurados,
  podeInstalar,
  packAtivo,
}: {
  pack: BusinessPackGravado | null;
  definition: BusinessPackDefinition | null;
  assistentesConfigurados: number;
  podeInstalar: boolean;
  packAtivo: boolean;
}) {
  const resumo = definition ? resumoDoPack(definition) : null;

  if (pack && definition && resumo) {
    return (
      <section
        className="space-y-4 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        data-testid="modelo-do-negocio"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Modelo do seu negócio
          </p>
          <h2
            className="mt-1 text-lg font-semibold tracking-tight"
            data-testid={packAtivo ? "pack-locadora-ativo" : "pack-locadora-inativo"}
          >
            Locadora de veículos
          </h2>
          <p className="text-sm text-muted-foreground">
            {packAtivo ? "Pack ativo" : "Pack instalado e desativado"}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <Item rotulo="Versão" valor={pack.version} />
          <Item rotulo="Status" valor={packAtivo ? "Ativo" : "Desativado"} />
          <Item rotulo="Assistentes" valor={`${assistentesConfigurados} configurados`} />
        </dl>
        <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <li>{resumo.assistentes} assistentes</li>
          <li>Funil comercial</li>
          <li>Knowledge organizado</li>
          <li>Automações (nascem desligadas)</li>
          <li>Respostas rápidas</li>
          <li>Campanhas</li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={packAtivo ? "/app/ai/agents" : "/app/modelos-prontos"}>
              {packAtivo ? "Ver meus assistentes" : "Ativar de novo"}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/app/modelos-prontos">
              {packAtivo ? "Ver detalhes e desativar" : "Ver detalhes"}
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="space-y-4 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      data-testid="modelo-do-negocio"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Modelo do seu negócio
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">Escolha um modelo pronto</h2>
        <p className="text-sm text-muted-foreground">
          Ainda não há um modelo de negócio ativo. Escolha um modelo pronto para configurar seu
          CRM.
        </p>
      </div>
      <div className="rounded-[12px] border border-[var(--color-border)] p-4">
        <p className="font-medium">Locadora de veículos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Atendimento, vendas, disponibilidade, cobranças e relacionamento, já organizados para
          uma locadora.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {podeInstalar ? (
            <Button asChild>
              <Link href="/app/modelos-prontos" data-testid="ativar-pack-locadora">
                Ativar Pack Locadora
              </Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Peça a quem administra para ativar.</p>
          )}
          <Button asChild variant="outline">
            <Link href="/app/modelos-prontos#o-que-instala" data-testid="ver-o-que-sera-instalado">
              Ver o que será instalado
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
