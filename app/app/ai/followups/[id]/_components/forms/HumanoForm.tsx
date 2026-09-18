"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { humanoConfigSchema } from "@/lib/followup/graph-schema";

import type { ConfigOf } from "./shared";

export function HumanoForm({
  config,
  onChange,
}: {
  config: ConfigOf<"humano">;
  onChange: (c: ConfigOf<"humano">) => void;
}) {
  const [phrase, setPhrase] = useState(config.phrase ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor="humano-phrase">Recado (opcional)</Label>
      <Textarea
        id="humano-phrase"
        maxLength={500}
        value={phrase}
        onChange={(e) => {
          setPhrase(e.target.value);
          const parsed = humanoConfigSchema.safeParse(
            e.target.value.trim() ? { phrase: e.target.value } : {},
          );
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Configuração inválida.");
            return;
          }
          setError(null);
          onChange(parsed.data);
        }}
      />
      {error && <p className="text-xs text-error-fg">{error}</p>}
    </div>
  );
}
