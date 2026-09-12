"use client";

import { useRetratoMoope } from "@/hooks/moope/useRetratoMoope";
import { NAO_CONSEGUI_CONSULTAR } from "@/lib/moope/retrato-comercial";

export function RetratoMoope({ contactId }: { contactId: string }) {
  const q = useRetratoMoope(contactId);
  if (q.isLoading) {
    return (
      <section
        className="rounded-lg border border-border p-3"
        data-testid="retrato-moope"
        data-estado="carregando"
      >
        <h3 className="text-xs font-medium text-muted-foreground">MOOPE Gestão</h3>
        <p className="mt-1 text-sm text-muted-foreground">Consultando…</p>
      </section>
    );
  }
  const data = q.data;
  if (!data) return null;
  if (!data.disponivel) {
    if (data.motivo === "sem_vinculo_moope") return null;
    return (
      <section
        className="rounded-lg border border-border p-3"
        data-testid="retrato-moope"
        data-estado="falha"
      >
        <h3 className="text-xs font-medium text-muted-foreground">MOOPE Gestão</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.mensagem ?? NAO_CONSEGUI_CONSULTAR}
        </p>
      </section>
    );
  }
  const r = data.retrato;
  if (!r) return null;
  const status = r.contrato_status ?? (r.em_dia === false ? "Em atraso" : r.em_dia ? "Em dia" : null);
  return (
    <section className="rounded-lg border border-border p-3" data-testid="retrato-moope" data-estado="ok">
      <h3 className="text-xs font-medium text-muted-foreground">MOOPE Gestão</h3>
      <p className="mt-1 text-sm font-medium">{r.nome || "Cliente"}</p>
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {r.veiculo_modelo || r.placa ? (
          <li>
            {[r.veiculo_modelo, r.placa].filter(Boolean).join(" · ")}
          </li>
        ) : null}
        {r.contrato_titulo ? <li>{r.contrato_titulo}</li> : null}
        {status ? <li>Status: {status}</li> : null}
        {r.days_late != null && r.days_late > 0 ? <li>Atraso: {r.days_late} dia(s)</li> : null}
      </ul>
      {r.portal_url ? (
        <a
          href={r.portal_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs font-medium underline"
        >
          Ver na Gestão
        </a>
      ) : null}
    </section>
  );
}
