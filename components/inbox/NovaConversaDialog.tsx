"use client";

import { useEffect, useMemo, useState } from "react";

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
import { channelLabel, useChannelSessions } from "@/hooks/channels/useChannelSessions";
import { useContactList } from "@/hooks/contacts/useContactList";
import { useAbrirConversaComContato } from "@/hooks/inbox/useAbrirConversaComContato";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { parseDialablePhone } from "@/lib/messaging/contact-card";
import { MagnifyingGlass } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { showApiError } from "@/components/feedback/ApiErrorToast";

export function NovaConversaDialog({
  open,
  onOpenChange,
  onAbriu,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAbriu: (conversationId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abrir = useAbrirConversaComContato();
  const { data: sessoes } = useChannelSessions();
  const vivas = useMemo(
    () => (sessoes ?? []).filter((s) => s.status === "WORKING"),
    [sessoes],
  );
  const qrPrimeiro = useMemo(
    () => [...vivas].sort((a, b) => Number(!!b.waha_session_name) - Number(!!a.waha_session_name)),
    [vivas],
  );

  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebounced("");
      setManualName("");
      setManualPhone("");
      return;
    }
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search, open]);

  useEffect(() => {
    if (!open) return;
    if (sessionId && qrPrimeiro.some((s) => s.id === sessionId)) return;
    setSessionId(qrPrimeiro[0]?.id ?? null);
  }, [open, qrPrimeiro, sessionId]);

  const searchPhone = parseDialablePhone(debounced);
  useEffect(() => {
    if (searchPhone) setManualPhone(searchPhone);
  }, [searchPhone]);

  const list = useContactList({ search: debounced || undefined });
  const contacts =
    list.data?.pages.flatMap((p) => p.data).filter((c) => {
      if (c.is_anonymized) return false;
      return Boolean(c.phone_number);
    }) ?? [];

  async function abrirCom(body: {
    contact_id?: string;
    phone_number?: string;
    name?: string;
  }) {
    if (!sessionId) return;
    try {
      const r = await abrir.mutateAsync({ channel_session_id: sessionId, ...body });
      onOpenChange(false);
      onAbriu(r.conversation_id);
    } catch (e) {
      showApiError(e);
    }
  }

  const telefoneManual = parseDialablePhone(manualPhone);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="inbox-nova-conversa">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>
            Escolha alguém da base ou um telefone. Se não houver histórico neste
            número, a conversa começa agora — como no WhatsApp da empresa.
          </DialogDescription>
        </DialogHeader>

        {qrPrimeiro.length > 1 ? (
          <div className="space-y-1">
            <Label htmlFor="nova-sessao">Sair pelo número</Label>
            <select
              id="nova-sessao"
              className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm"
              value={sessionId ?? ""}
              onChange={(e) => setSessionId(e.target.value)}
            >
              {qrPrimeiro.map((s) => (
                <option key={s.id} value={s.id}>
                  {channelLabel(s)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {vivas.length === 0 ? (
          <p className="text-sm text-destructive">
            Nenhum WhatsApp conectado. Vá em Conexões e reconecte o número.
          </p>
        ) : null}

        <div className="relative">
          <MagnifyingGlass
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou telefone"
            className="pl-8"
            autoFocus
          />
        </div>

        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {contacts.length === 0 ? (
            <li className="px-1 py-2 text-xs text-[var(--color-text-muted)]">
              {debounced
                ? "Ninguém com esse nome na base. Pode mandar pelo telefone abaixo."
                : "Digite para achar um contato."}
            </li>
          ) : (
            contacts.slice(0, 20).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-start rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--color-bg)]",
                  )}
                  onClick={() =>
                    void abrirCom({
                      contact_id: c.id,
                      phone_number: c.phone_number ?? undefined,
                      name: rotuloDoContato(c),
                    })
                  }
                  disabled={abrir.isPending || !sessionId}
                >
                  <span className="font-medium">{rotuloDoContato(c)}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{c.phone_number}</span>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="nova-nome">Nome (se for novo)</Label>
            <Input
              id="nova-nome"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="June"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nova-fone">Telefone</Label>
            <Input
              id="nova-fone"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="61 9…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            data-testid="inbox-nova-conversa-enviar"
            disabled={!telefoneManual || !sessionId || abrir.isPending}
            onClick={() =>
              void abrirCom({
                phone_number: telefoneManual ?? undefined,
                name: manualName.trim() || undefined,
              })
            }
          >
            {abrir.isPending ? "Abrindo…" : "Abrir conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
