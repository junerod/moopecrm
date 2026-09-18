"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { menuConfigSchema } from "@/lib/followup/graph-schema";

import type { ConfigOf } from "./shared";

export function MenuForm({
  config,
  onChange,
}: {
  config: ConfigOf<"menu">;
  onChange: (c: ConfigOf<"menu">) => void;
}) {
  const [title, setTitle] = useState(config.title);
  const [retry, setRetry] = useState(config.retry_text ?? "");
  const [options, setOptions] = useState(config.options);
  const [error, setError] = useState<string | null>(null);

  const commit = (next: ConfigOf<"menu">) => {
    const parsed = menuConfigSchema.safeParse(next);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Configuração inválida.");
      return;
    }
    setError(null);
    onChange(parsed.data);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="menu-title">Título do menu</Label>
        <Input
          id="menu-title"
          value={title}
          maxLength={200}
          onChange={(e) => {
            setTitle(e.target.value);
            commit({ title: e.target.value, options, ...(retry.trim() ? { retry_text: retry } : {}) });
          }}
        />
      </div>
      <div className="space-y-2">
        {options.map((opt, idx) => (
          <div key={opt.id} className="grid grid-cols-[3rem_1fr] gap-2">
            <Input
              aria-label={`Número da opção ${idx + 1}`}
              type="number"
              min={1}
              max={9}
              value={opt.number}
              onChange={(e) => {
                const next = options.map((o, i) =>
                  i === idx ? { ...o, number: Number(e.target.value) } : o,
                );
                setOptions(next);
                commit({ title, options: next, ...(retry.trim() ? { retry_text: retry } : {}) });
              }}
            />
            <Input
              aria-label={`Texto da opção ${idx + 1}`}
              value={opt.label}
              maxLength={80}
              onChange={(e) => {
                const next = options.map((o, i) => (i === idx ? { ...o, label: e.target.value } : o));
                setOptions(next);
                commit({ title, options: next, ...(retry.trim() ? { retry_text: retry } : {}) });
              }}
            />
          </div>
        ))}
        {options.length < 9 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const n = options.length + 1;
              const next = [
                ...options,
                { id: `opt_${n}_${Date.now()}`, number: n, label: `Opção ${n}`, keywords: [] },
              ];
              setOptions(next);
              commit({ title, options: next, ...(retry.trim() ? { retry_text: retry } : {}) });
            }}
          >
            Adicionar opção
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="menu-retry">Se não entender (opcional)</Label>
        <Input
          id="menu-retry"
          value={retry}
          maxLength={200}
          onChange={(e) => {
            setRetry(e.target.value);
            commit({ title, options, ...(e.target.value.trim() ? { retry_text: e.target.value } : {}) });
          }}
        />
      </div>
      {error && <p className="text-xs text-error-fg">{error}</p>}
    </div>
  );
}
