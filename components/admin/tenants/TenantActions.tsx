"use client";
import { useState } from "react";
import { toast } from "sonner";

import { DefinirSenhaDeMembroDialog } from "@/components/auth/DefinirSenhaDeMembroDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImpersonateButton } from "@/components/admin/ImpersonateButton";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { SuspendDialog } from "./SuspendDialog";
import { ReactivateDialog } from "./ReactivateDialog";

type Membro = {
  user_id: string;
  role: string;
  email: string | null;
  full_name: string | null;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TenantActionsProps {
  organizationId: string;
  status: "active" | "suspended" | "redacted";
  displayName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TenantActions({
  organizationId,
  status,
  displayName,
}: TenantActionsProps) {
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [senhaOpen, setSenhaOpen] = useState(false);
  const [senhaPending, setSenhaPending] = useState(false);
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [alvo, setAlvo] = useState<string>("");

  const canSuspend = status === "active";
  const isSuspended = status === "suspended";
  const isRedacted = status === "redacted";

  return (
    <>
      <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Ações
        </h2>

        {!isRedacted && (
          <Button
            className="w-full"
            variant="outline"
            onClick={async () => {
              setSenhaOpen(true);
              try {
                const r = await apiClient.get<{ data: Membro[] }>(
                  `/api/v1/admin/tenants/${organizationId}/members`,
                );
                setMembros(r.data);
                const unico = r.data[0];
                if (r.data.length === 1 && unico) setAlvo(unico.user_id);
              } catch (err) {
                showApiError(err);
              }
            }}
          >
            Definir senha do tenant
          </Button>
        )}

        {/* Impersonate (S-11.07) */}
        <ImpersonateButton
          organizationId={organizationId}
          displayName={displayName}
          disabled={isRedacted}
          disabledReason={
            isRedacted ? "Tenant redigido — ação não disponível" : undefined
          }
        />

        {/* Suspend */}
        {canSuspend && (
          <Button
            className="w-full"
            variant="destructive"
            onClick={() => setSuspendOpen(true)}
            aria-label="Suspender tenant"
          >
            Suspender tenant
          </Button>
        )}

        {/* Reactivate */}
        {isSuspended && (
          <Button
            className="w-full"
            variant="outline"
            onClick={() => setReactivateOpen(true)}
            aria-label="Reativar tenant"
          >
            Reativar tenant
          </Button>
        )}

        {isRedacted && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Tenant redigido — ações de gestão não disponíveis.
          </p>
        )}
      </div>

      <SuspendDialog
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        organizationId={organizationId}
      />

      <ReactivateDialog
        open={reactivateOpen}
        onClose={() => setReactivateOpen(false)}
        organizationId={organizationId}
      />

      <DefinirSenhaDeMembroDialog
        open={senhaOpen}
        onClose={() => {
          setSenhaOpen(false);
          setAlvo("");
        }}
        titulo="Definir senha do tenant"
        descricao={`Quem entra em ${displayName} recebe esta senha e troca no próximo login.`}
        pending={senhaPending}
        extra={
          <div className="space-y-2">
            <Label htmlFor="senha_alvo">Quem recebe a senha</Label>
            <Select value={alvo} onValueChange={setAlvo}>
              <SelectTrigger id="senha_alvo" aria-label="Quem recebe a senha">
                <SelectValue placeholder={membros ? "Escolha a pessoa" : "Carregando…"} />
              </SelectTrigger>
              <SelectContent>
                {(membros ?? []).map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.email ?? m.full_name ?? m.user_id.slice(0, 8)} ({m.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        onConfirm={async (password, password_confirm) => {
          if (!alvo) {
            toast.error("Escolha quem vai receber a senha.");
            return;
          }
          setSenhaPending(true);
          try {
            await apiClient.post(`/api/v1/admin/tenants/${organizationId}/password`, {
              user_id: alvo,
              password,
              password_confirm,
            });
            toast.success("Senha definida.");
            setSenhaOpen(false);
            setAlvo("");
          } catch (err) {
            showApiError(err);
          } finally {
            setSenhaPending(false);
          }
        }}
      />
    </>
  );
}
