"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { alterarSenhaDaConta } from "@/app/actions/settings/alterarSenhaDaConta";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordSchema } from "@/lib/auth/schemas";

export function TrocarSenhaForm() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = changePasswordSchema.safeParse({
      current_password: atual,
      password: nova,
      password_confirm: confirma,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    startTransition(async () => {
      const r = await alterarSenhaDaConta(parsed.data);
      if (r.ok) {
        toast.success("Senha alterada.");
        setAtual("");
        setNova("");
        setConfirma("");
        return;
      }
      const frase: Record<typeof r.error, string> = {
        validation_failed: "Dados inválidos.",
        unauthenticated: "Entre de novo para trocar a senha.",
        rate_limited: "Muitas tentativas. Espere alguns minutos.",
        wrong_password: "A senha atual não confere.",
        update_failed: "Não foi possível alterar a senha.",
      };
      toast.error(frase[r.error]);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-sm font-semibold">Trocar senha</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Informe a senha atual. A sessão continua aberta depois da troca.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="current_password">Senha atual</Label>
          <Input
            id="current_password"
            type="password"
            autoComplete="current-password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new_password">Nova senha</Label>
          <Input
            id="new_password"
            type="password"
            autoComplete="new-password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new_password_confirm">Confirmar nova senha</Label>
          <Input
            id="new_password_confirm"
            type="password"
            autoComplete="new-password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            required
          />
        </div>
        <div className="flex sm:justify-end">
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            {isPending ? "Salvando…" : "Alterar senha"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
