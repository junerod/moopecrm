import { PuzzlePiece } from "@/lib/ui/icons";

import { AssessorAlertClient } from "./_client";

export const dynamic = "force-dynamic";

export default function AssessorIntegrationPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-start gap-4">
        <div className="rounded-md border border-border bg-surface p-3">
          <PuzzlePiece size={28} weight="duotone" className="text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Meu Assessor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Libere o WhatsApp de quem deve ficar atento. Cliente novo no CRM vira um aviso nesse número.
          </p>
        </div>
      </header>
      <AssessorAlertClient />
    </div>
  );
}
