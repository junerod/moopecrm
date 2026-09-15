"use client";

import { compararDuasCampanhas, type MetricasDaCampanha } from "@/lib/campanhas/metricas";
import { formatCentsBRL } from "@/lib/money";
import { AppCard } from "@/components/ds/AppCard";

export function CompararCampanhas({
  nomeA,
  nomeB,
  a,
  b,
}: {
  nomeA: string;
  nomeB: string;
  a: MetricasDaCampanha;
  b: MetricasDaCampanha;
}) {
  const linhas = compararDuasCampanhas(a, b);
  return (
    <AppCard testid="campanhas-comparar">
      <p className="text-sm font-semibold text-[var(--color-text)]">Comparar campanhas</p>
      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
        Mesmo recorte: envio, resposta, negócio, ganho, conversão e receita.
        Quem disparou mais não é automaticamente quem vendeu.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--color-text-muted)]">
              <th className="py-1 pr-3 font-medium"> </th>
              <th className="py-1 pr-3 font-medium">{nomeA}</th>
              <th className="py-1 pr-3 font-medium">{nomeB}</th>
              <th className="py-1 font-medium">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave} className="border-t border-border/60">
                <td className="py-1.5 pr-3">{l.rotulo}</td>
                <td className="py-1.5 pr-3 tabular-nums">{celula(l.chave, l.a)}</td>
                <td className="py-1.5 pr-3 tabular-nums">{celula(l.chave, l.b)}</td>
                <td className="py-1.5 tabular-nums">{celula(l.chave, l.delta, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}

function celula(chave: string, n: number, comSinal = false): string {
  if (chave === "conversao") {
    const texto = `${Math.abs(n)}%`;
    if (!comSinal) return `${n}%`;
    if (n === 0) return "0%";
    return `${n > 0 ? "+" : "−"}${texto}`;
  }
  const texto =
    chave === "receita"
      ? formatCentsBRL(Math.abs(n))
      : String(Math.abs(n));
  if (!comSinal) return chave === "receita" ? formatCentsBRL(n) : String(n);
  if (n === 0) return chave === "receita" ? formatCentsBRL(0) : "0";
  return `${n > 0 ? "+" : "−"}${texto}`;
}
