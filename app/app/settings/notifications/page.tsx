import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { requireAuth } from "@/lib/auth/server";
import { Bell } from "@/lib/ui/icons";

import { AlertasPessoaisForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireAuth();
  return (
    <div className="flex h-full flex-col gap-6 bg-[var(--color-bg)] p-6">
      <PageHeader
        icon={<AppIcon icon={Bell} tone="amber" size="lg" />}
        titulo="Notificações"
        descricao="Alertas operacionais no seu WhatsApp particular."
      />
      <AlertasPessoaisForm />
    </div>
  );
}
