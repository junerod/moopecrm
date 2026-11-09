"use client";

import { useState, type ReactNode } from "react";

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
import { definirSenhaDeMembroSchema } from "@/lib/auth/schemas";

export function DefinirSenhaDeMembroDialog({
  open,
  onClose,
  titulo,
  descricao,
  pending,
  onConfirm,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  descricao: string;
  pending: boolean;
  onConfirm: (password: string, passwordConfirm: string) => Promise<void>;
  extra?: ReactNode;
}) {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    if (pending) return;
    setSenha("");
    setConfirma("");
    setErro(null);
    onClose();
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const parsed = definirSenhaDeMembroSchema.safeParse({
      password: senha,
      password_confirm: confirma,
    });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setErro(null);
    await onConfirm(parsed.data.password, parsed.data.password_confirm);
    setSenha("");
    setConfirma("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && fechar()}>
      <DialogContent>
        <form onSubmit={enviar}>
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>{descricao}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {extra}
            <div className="space-y-2">
              <Label htmlFor="admin_new_password">Nova senha</Label>
              <Input
                id="admin_new_password"
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_new_password_confirm">Confirmar senha</Label>
              <Input
                id="admin_new_password_confirm"
                type="password"
                autoComplete="new-password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                required
              />
            </div>
            {erro ? <p className="text-xs text-destructive">{erro}</p> : null}
            <p className="text-xs text-muted-foreground">
              No próximo login essa pessoa troca a senha de novo.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={fechar} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Definir senha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
