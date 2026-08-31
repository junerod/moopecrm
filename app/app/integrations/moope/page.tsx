import { PuzzlePiece } from "@/lib/ui/icons";

import { MoopeConnectionClient } from "./_client";

export const dynamic = "force-dynamic";

export default function MoopeIntegrationPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-start gap-4">
        <div className="rounded-md border border-border bg-surface p-3">
          <PuzzlePiece size={28} weight="duotone" className="text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Integração MOOPE</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Uma chave para a frota ou o Facejus abrir o CRM pelo menu e mandar
            cadastro. O outro sistema continua dono do contrato e do processo;
            aqui fica o atendimento.
          </p>
        </div>
      </header>
      <MoopeConnectionClient />
    </div>
  );
}
