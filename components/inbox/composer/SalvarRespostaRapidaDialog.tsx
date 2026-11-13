"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import { tituloDaRespostaRapida } from "@/lib/inbox/titulo-da-resposta-rapida";
import type { MessageTemplate } from "@/hooks/inbox/useMessageTemplates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  corpo: string;
}

export function SalvarRespostaRapidaDialog({ open, onOpenChange, corpo }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const qc = useQueryClient();
  const salvar = useMutation({
    mutationFn: async () =>
      apiClient.post<{ data: MessageTemplate }>("/api/v1/message-templates", {
        title,
        body,
        shared: false,
      }),
    onError: showApiError,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["message-templates"] }),
  });

  useEffect(() => {
    if (!open) return;
    setTitle(tituloDaRespostaRapida(corpo));
    setBody(corpo);
  }, [open, corpo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await salvar.mutateAsync();
              toast.success("Resposta rápida salva.");
              onOpenChange(false);
            } catch {
              /* toast de erro já saiu no onError */
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Salvar resposta rápida</DialogTitle>
            <DialogDescription>
              Corrija as palavras se precisar. Fica na sua lista — use pelo / na caixa.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="resposta-rapida-titulo">Título</Label>
              <Input
                id="resposta-rapida-titulo"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                required
                lang="pt-BR"
                spellCheck
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resposta-rapida-corpo">Texto</Label>
              <Textarea
                id="resposta-rapida-corpo"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                required
                lang="pt-BR"
                spellCheck
                data-testid="salvar-resposta-rapida-corpo"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending || !title.trim() || !body.trim()}>
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
