import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { loadOnboardingState } from "@/app/actions/onboarding/_shared";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { CabecalhoDoPasso } from "@/app/onboarding/_components/Cartao";
import { PackReviewForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function PackOnboardingPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");

  const { state } = await loadOnboardingState(activeOrg.orgId);
  const packId = state.welcome?.pack_id;
  if (!packId) redirect("/onboarding");
  const pack = resolverPack(packId);
  if (!pack) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <CabecalhoDoPasso
        titulo="Vamos preparar sua operação"
        subtitulo={`${pack.label}: funil, assistentes, conhecimento e automações prontos para revisar.`}
      />
      <PackReviewForm label={pack.label} />
    </div>
  );
}
