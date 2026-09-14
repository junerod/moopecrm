import Link from "next/link";

import { Button } from "@/components/ui/button";
import { resumoDoPack } from "@/lib/business-packs/apresentacao";
import { testidAtivarPackCard, testidPackAtivo, testidPackInativo } from "@/lib/business-packs/testids";
import type { BusinessPackDefinition, BusinessPackGravado, BusinessPackId } from "@/lib/business-packs/tipos";

const ATALHOS_DO_PACK = [
  { href: "/app/ai/agents", label: "Ver assistentes" },
  { href: "/app/kanban", label: "Abrir funil" },
  { href: "/app/ai/knowledge/sources", label: "Adicionar conhecimento" },
  { href: "/app/ai/followups", label: "Ver automações" },
  { href: "/app/campanhas/nova", label: "Criar campanha" },
];

export function ModeloDoNegocio({
  pack,
  definition,
  catalogo,
  assistentesConfigurados,
  podeInstalar,
  packAtivo,
}: {
  pack: BusinessPackGravado | null;
  definition: BusinessPackDefinition | null;
  catalogo: Array<{ id: BusinessPackId; label: string; description: string }>;
  assistentesConfigurados: number;
  podeInstalar: boolean;
  packAtivo: boolean;
}) {
  const resumo = definition ? resumoDoPack(definition) : null;
  const testidAtivo = pack ? testidPackAtivo(pack.id) : "pack-locadora-ativo";
  const testidInativo = pack ? testidPackInativo(pack.id) : "pack-locadora-inativo";

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
            data-testid={packAtivo ? testidAtivo : testidInativo}
          >
            {definition.label}
          </h2>
          <p className="text-sm text-muted-foreground">
            {packAtivo ? `Pack ativo: ${definition.label}` : "Pack instalado e desativado"}
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
        {packAtivo ? (
          <nav aria-label="Atalhos do modelo" className="flex flex-wrap gap-2">
            {ATALHOS_DO_PACK.map((a) => (
              <Button key={a.href} asChild variant="outline" size="sm">
                <Link href={a.href}>{a.label}</Link>
              </Button>
            ))}
          </nav>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={packAtivo ? "/app/meu-modelo" : "/app/modelos-prontos"}>
              {packAtivo ? "Abrir meu modelo" : "Ativar de novo"}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={packAtivo ? "/app/meu-modelo" : "/app/modelos-prontos"}>
              {packAtivo ? "Continuar configuração" : "Ver modelos"}
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
      <div className="grid gap-3">
        {catalogo.map((item) => (
          <div key={item.id} className="rounded-[12px] border border-[var(--color-border)] p-4">
            <p className="font-medium">{item.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {podeInstalar ? (
                <Button asChild>
                  <Link
                    href={`/app/modelos-prontos/${item.id}`}
                    data-testid={testidAtivarPackCard(item.id)}
                  >
                    Ativar modelo
                  </Link>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Peça a quem administra para ativar.</p>
              )}
              <Button asChild variant="outline">
                <Link href={`/app/modelos-prontos/${item.id}`} data-testid="ver-o-que-sera-instalado">
                  Ver o que será instalado
                </Link>
              </Button>
            </div>
          </div>
        ))}
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
