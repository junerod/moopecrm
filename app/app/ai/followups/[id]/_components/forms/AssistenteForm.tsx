"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assistenteConfigSchema } from "@/lib/followup/graph-schema";

import type { ConfigOf } from "./shared";

export function AssistenteForm({
  config,
  onChange,
}: {
  config: ConfigOf<"assistente">;
  onChange: (c: ConfigOf<"assistente">) => void;
}) {
  const [specialty, setSpecialty] = useState(config.specialty ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor="assistente-specialty">Especialidade (opcional)</Label>
      <Input
        id="assistente-specialty"
        maxLength={40}
        value={specialty}
        placeholder="ex.: recepcao"
        onChange={(e) => {
          setSpecialty(e.target.value);
          const parsed = assistenteConfigSchema.safeParse(
            e.target.value.trim() ? { specialty: e.target.value } : {},
          );
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Configuração inválida.");
            return;
          }
          setError(null);
          onChange(parsed.data);
        }}
      />
      <p className="text-xs text-text-muted">
        Encerra o bot. A próxima mensagem do cliente cai no assistente publicado.
      </p>
      {error && <p className="text-xs text-error-fg">{error}</p>}
    </div>
  );
}
