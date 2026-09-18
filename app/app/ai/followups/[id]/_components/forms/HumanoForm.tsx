"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTeamMembers } from "@/hooks/team/useTeamMembers";
import { humanoConfigSchema } from "@/lib/followup/graph-schema";

import type { ConfigOf } from "./shared";

const PODE_RECEBER = new Set(["agent", "manager", "admin"]);

function gravar(candidato: ConfigOf<"humano">) {
  const limpo = {
    ...(candidato.phrase?.trim() ? { phrase: candidato.phrase.trim() } : {}),
    ...(candidato.notify_user_id ? { notify_user_id: candidato.notify_user_id } : {}),
    ...(candidato.team_note?.trim() ? { team_note: candidato.team_note.trim() } : {}),
  };
  const parsed = humanoConfigSchema.safeParse(limpo);
  return parsed.success ? parsed.data : null;
}

export function HumanoForm({
  config,
  onChange,
}: {
  config: ConfigOf<"humano">;
  onChange: (c: ConfigOf<"humano">) => void;
}) {
  const equipe = useTeamMembers();
  const [phrase, setPhrase] = useState(config.phrase ?? "");
  const [nota, setNota] = useState(config.team_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const pessoas = (equipe.data?.data ?? []).filter(
    (m) => m.revoked_at === null && m.accepted_at !== null && PODE_RECEBER.has(m.role),
  );
  const escolhidaSumiu =
    Boolean(config.notify_user_id) && !pessoas.some((m) => m.user_id === config.notify_user_id);

  function aplicar(parcial: Partial<ConfigOf<"humano">>) {
    const proximo = gravar({ ...config, phrase, team_note: nota, ...parcial });
    if (!proximo) {
      setError("Não deu para guardar. Encurte o texto.");
      return;
    }
    setError(null);
    onChange(proximo);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="humano-phrase">O que o cliente lê</Label>
        <Textarea
          id="humano-phrase"
          maxLength={500}
          value={phrase}
          placeholder="Vou te passar para uma pessoa da equipe."
          onChange={(e) => {
            setPhrase(e.target.value);
            aplicar({ phrase: e.target.value });
          }}
        />
        <p className="text-xs text-text-muted">Sai no WhatsApp, do jeito que está escrito.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="humano-nota">Comentário para a equipe</Label>
        <Textarea
          id="humano-nota"
          maxLength={500}
          value={nota}
          placeholder="Cliente quer marcar horário. Confirme dia e hora."
          onChange={(e) => {
            setNota(e.target.value);
            aplicar({ team_note: e.target.value });
          }}
          data-testid="humano-comentario"
        />
        <p className="text-xs text-text-muted">O cliente não vê. Aparece na Central, para quem for atender.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="humano-pessoa">Quem recebe a conversa</Label>
        <select
          id="humano-pessoa"
          className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          value={config.notify_user_id ?? ""}
          onChange={(e) => aplicar({ notify_user_id: e.target.value || undefined })}
          data-testid="humano-pessoa"
        >
          <option value="">Quem estiver na Central</option>
          {escolhidaSumiu ? <option value={config.notify_user_id}>Pessoa que saiu da equipe</option> : null}
          {pessoas.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name?.trim() || m.email || "Pessoa da equipe"}
            </option>
          ))}
        </select>
        <p className="text-xs text-text-muted">
          A conversa cai para essa pessoa no CRM. O cliente continua neste WhatsApp.
        </p>
      </div>
      {error ? <p className="text-xs text-error-fg">{error}</p> : null}
    </div>
  );
}
