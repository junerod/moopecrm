import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";

import type { RelatorioSelfTest } from "@/lib/self-test/tipos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diagnóstico — Admin" };

async function lerUltimo(): Promise<RelatorioSelfTest | null> {
  try {
    const bruto = await readFile(path.join(process.cwd(), "docs", "self-test", "latest.json"), "utf8");
    return JSON.parse(bruto) as RelatorioSelfTest;
  } catch {
    return null;
  }
}

export default async function DiagnosticoPage() {
  const ultimo = await lerUltimo();
  const ok = ultimo?.modulos.filter((m) => m.status === "PASS").length ?? 0;
  const externo = ultimo?.modulos.filter((m) => m.modulo === "whatsapp_externo" && m.status === "SKIPPED").length ?? 0;
  const quando = ultimo?.gerado_em
    ? new Date(ultimo.gerado_em).toLocaleString("pt-BR")
    : "ainda não rodou";

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Diagnóstico</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saúde do CRM. Esta tela só lê o último relatório. Nenhum clique dispara canal externo.
        </p>
      </div>

      <section
        className="max-w-lg space-y-3 rounded-[16px] border border-border bg-card p-5"
        data-testid="saude-do-crm"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saúde do CRM</p>
        <p className="text-sm text-muted-foreground">Último autoteste: {quando}</p>
        {ultimo ? (
          <>
            <p className="text-lg font-semibold" data-testid="self-test-total">
              {ultimo.total}
            </p>
            <p className="text-sm text-muted-foreground">
              {ok} módulos OK
              {externo ? " · 1 externo não executado" : ""}
            </p>
            <Link
              href="/admin/diagnostico#relatorio"
              className="inline-flex text-sm font-medium underline"
              data-testid="ver-relatorio-self-test"
            >
              Ver relatório
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum autoteste nesta instalação. No servidor, rode <code>pnpm product:self-test</code>.
          </p>
        )}
      </section>

      {ultimo ? (
        <section id="relatorio" className="max-w-2xl space-y-2 text-sm">
          <h2 className="text-base font-semibold">Relatório</h2>
          <ul className="space-y-1">
            {ultimo.modulos.map((m) => (
              <li key={m.modulo}>
                <span className="font-medium">{m.modulo}</span> — {m.status}
                <span className="block text-muted-foreground">{m.detalhe}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
