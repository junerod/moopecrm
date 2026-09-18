"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { faqConfigSchema } from "@/lib/followup/graph-schema";

import type { ConfigOf } from "./shared";

export function FaqForm({
  config,
  onChange,
}: {
  config: ConfigOf<"faq">;
  onChange: (c: ConfigOf<"faq">) => void;
}) {
  const [items, setItems] = useState(config.items);
  const [error, setError] = useState<string | null>(null);

  const commit = (next: ConfigOf<"faq">) => {
    const parsed = faqConfigSchema.safeParse(next);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Configuração inválida.");
      return;
    }
    setError(null);
    onChange(parsed.data);
  };

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.id} className="space-y-2 rounded-md border border-border p-2">
          <Label htmlFor={`faq-kw-${item.id}`}>Palavras-chave</Label>
          <Input
            id={`faq-kw-${item.id}`}
            value={item.keywords.join(", ")}
            onChange={(e) => {
              const keywords = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              const next = items.map((it, i) => (i === idx ? { ...it, keywords } : it));
              setItems(next);
              commit({ items: next });
            }}
          />
          <Label htmlFor={`faq-ans-${item.id}`}>Resposta</Label>
          <Textarea
            id={`faq-ans-${item.id}`}
            maxLength={1000}
            value={item.answer}
            onChange={(e) => {
              const next = items.map((it, i) => (i === idx ? { ...it, answer: e.target.value } : it));
              setItems(next);
              commit({ items: next });
            }}
          />
        </div>
      ))}
      {items.length < 8 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const next = [
              ...items,
              { id: `faq_${Date.now()}`, keywords: ["duvida"], answer: "Resposta fixa." },
            ];
            setItems(next);
            commit({ items: next });
          }}
        >
          Adicionar resposta
        </Button>
      )}
      {error && <p className="text-xs text-error-fg">{error}</p>}
    </div>
  );
}
