"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { quandoDoPreset, type PresetDeQuando } from "@/lib/comercial/proxima-acao";

const PRESETS: Array<{ id: PresetDeQuando; rotulo: string }> = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "amanha", rotulo: "Amanhã" },
  { id: "em_2_dias", rotulo: "Em 2 dias" },
];

export function ProximaAcaoControles({
  textoInicial,
  emInicial,
  salvando,
  onSalvar,
  onCancelar,
}: {
  textoInicial?: string;
  emInicial?: string | null;
  salvando?: boolean;
  onSalvar: (texto: string, em: string | null) => void | Promise<void>;
  onCancelar?: () => void;
}) {
  const inicial = emInicial ? new Date(emInicial) : null;
  const [texto, setTexto] = useState(textoInicial ?? "");
  const [data, setData] = useState(
    inicial && !Number.isNaN(inicial.getTime()) ? inicial.toISOString().slice(0, 10) : "",
  );
  const [hora, setHora] = useState(
    inicial && !Number.isNaN(inicial.getTime())
      ? `${String(inicial.getHours()).padStart(2, "0")}:${String(inicial.getMinutes()).padStart(2, "0")}`
      : "",
  );

  function aplicarPreset(preset: PresetDeQuando) {
    const d = quandoDoPreset(preset);
    const pad = (n: number) => String(n).padStart(2, "0");
    setData(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setHora(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }

  function iso(): string | null {
    if (!data) return null;
    const ymd = data.split("-").map(Number);
    const hm = (hora || "10:00").split(":").map(Number);
    const y = ymd[0];
    const m = ymd[1];
    const day = ymd[2];
    const hh = hm[0] ?? 10;
    const mm = hm[1] ?? 0;
    if (y == null || m == null || day == null) return null;
    return new Date(y, m - 1, day, hh, mm, 0, 0).toISOString();
  }

  return (
    <div className="space-y-1.5" data-testid="proxima-acao-controles">
      <input
        data-testid="inbox-proximo-passo-texto"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={500}
        placeholder="Ligar para confirmar documentos"
        className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      />
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            data-testid={`preset-quando-${p.id}`}
            onClick={() => aplicarPreset(p.id)}
          >
            {p.rotulo}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <input
          type="date"
          data-testid="inbox-proximo-passo-data"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
        <input
          type="time"
          data-testid="inbox-proximo-passo-hora"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          className="min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          className="h-8 text-xs"
          disabled={salvando || texto.trim().length < 3}
          data-testid="inbox-salvar-proximo-passo"
          onClick={() => void onSalvar(texto.trim(), iso())}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
        {onCancelar ? (
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={onCancelar}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
