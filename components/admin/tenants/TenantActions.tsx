"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SuspendDialog } from "./SuspendDialog";
import { ReactivateDialog } from "./ReactivateDialog";
import { ImpersonateButton } from "@/components/admin/ImpersonateButton";

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

  const canSuspend = status === "active";
  const isSuspended = status === "suspended";
  const isRedacted = status === "redacted";

  return (
    <>
      <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Ações
        </h2>

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
    </>
  );
}
