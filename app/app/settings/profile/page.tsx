import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { requireAuth } from "@/lib/auth/server";
import { UserCircle } from "@/lib/ui/icons";

import { ProfileForm } from "./_form";
import { TrocarSenhaForm } from "./_senha";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireAuth();
  const meta = (user as unknown as { full_name: string | null; avatar_url: string | null });
  // Read locale/timezone from raw user meta if present (loadAuthUser doesn't include them).
  // We pass safe defaults that the form re-syncs on submit.
  return (
    <div className="flex h-full flex-col gap-6 bg-[var(--color-bg)] p-6">
      <PageHeader
        icon={<AppIcon icon={UserCircle} tone="blue" size="lg" />}
        titulo="Perfil"
        descricao="Seu nome nesta conta e a senha de entrada."
      />
      <ProfileForm
        email={user.email}
        initialFullName={meta.full_name}
        initialAvatarUrl={meta.avatar_url}
      />
      <TrocarSenhaForm />
    </div>
  );
}
