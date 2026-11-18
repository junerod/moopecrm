import Link from "next/link";

import { PuzzlePiece } from "@/lib/ui/icons";

import { MoopeConnectionClient } from "./_client";

export const dynamic = "force-dynamic";

export default function MoopeIntegrationPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-start gap-4">
        <div className="rounded-md border border-border bg-surface p-3">
          <PuzzlePiece size={28} weight="duotone" className="text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Integração MOOPE</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A locadora liga sozinha, na aba Atendimento. Aqui se confere o
            endereço de onde saem cadastro, oferta e boleto. A aba «Como o
            cliente pergunta» mostra o bot e o assistente. Para o Facejus só
            ler agenda, funil e indicadores, crie
            um token em{" "}
            <Link href="/app/settings/api-tokens" className="underline">
              Tokens de API
            </Link>
            — um por sistema, com nome e validade. O outro sistema continua
            dono do contrato e do processo.
          </p>
        </div>
      </header>
      <MoopeConnectionClient />
    </div>
  );
}
