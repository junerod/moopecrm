"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cenariosDoPack } from "@/lib/business-packs/test-drive";

type ResultadoTeste = {
  intent: string;
  specialty_name: string;
  knowledge_hint: string;
  tool_que_seria_chamada: string | null;
  resposta: string;
  precisa_humano: boolean;
};

export function TestDriveDoPack({ packId, instalado }: { packId: string | null; instalado: boolean }) {
  const cenarios = cenariosDoPack(packId);
  const [mensagem, setMensagem] = useState(cenarios[0]?.mensagem ?? "");
  const [teste, setTeste] = useState<ResultadoTeste | null>(null);
  const [testando, setTestando] = useState(false);

  async function testar() {
    setTestando(true);
    setTeste(null);
    try {
      const res = await fetch("/api/v1/business-packs/test-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem }),
      });
      const json = (await res.json()) as { data?: ResultadoTeste; error?: { message?: string } };
      if (!res.ok || !json.data) {
        toast.error(json.error?.message ?? "Não consegui testar agora.");
        return;
      }
      setTeste(json.data);
    } finally {
      setTestando(false);
    }
  }

  return (
    <section
      className="rounded-2xl bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-border)]"
      data-testid="testar-assistentes"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        Sem WhatsApp real
      </p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight">Como eles respondem</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Escolha uma frase típica. Nada é enviado e nenhuma consulta externa roda.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {cenarios.map((c) => (
          <Button key={c.id} type="button" variant="outline" size="sm" onClick={() => setMensagem(c.mensagem)}>
            {c.rotulo}
          </Button>
        ))}
      </div>
      <textarea
        data-testid="test-drive-mensagem"
        className="mt-3 min-h-24 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm"
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
      />
      <Button className="mt-3" data-testid="test-drive-enviar" disabled={testando || !instalado} onClick={() => void testar()}>
        {testando ? "Testando..." : "Testar"}
      </Button>
      {teste ? (
        <div
          data-testid="test-drive-resultado"
          className="mt-4 space-y-2 rounded-xl bg-[color-mix(in_srgb,var(--color-accent-soft)_40%,var(--color-surface))] p-4 text-sm"
        >
          <p className="text-xs text-[var(--color-text-muted)]">
            {teste.specialty_name} · {teste.intent}
            {teste.precisa_humano ? " · precisa de uma pessoa: sim" : " · precisa de uma pessoa: não"}
          </p>
          <p data-testid="test-drive-resposta" className="leading-6">
            {teste.resposta}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Conhecimento: {teste.knowledge_hint || "nenhum trecho ainda"} · Consulta que seria
            feita: {teste.tool_que_seria_chamada ?? "nenhuma"}
          </p>
        </div>
      ) : null}
    </section>
  );
}
