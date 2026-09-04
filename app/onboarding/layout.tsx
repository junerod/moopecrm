import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { loadOnboardingState } from "@/app/actions/onboarding/_shared";
import { Stepper } from "./_components/Stepper";
import { SkipToEnd } from "./_components/SkipToEnd";
import { ForcarTemaEscuro } from "./_components/ForcarTemaEscuro";
import { MarcaNoCabecalho } from "./_components/MarcaNoCanto";
import { branding } from "@/lib/branding";
import { passosVisiveis } from "@/lib/onboarding/passos";
import { env } from "@/lib/env";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");

  const { state, onboardedAt } = await loadOnboardingState(activeOrg.orgId);
  if (onboardedAt) redirect("/app/inbox");

  // Os passos que ESTA instalação oferece, com o que já foi resolvido. O
  // indicador não decide mais nada sozinho — ele desenha o que recebe.
  const passos = passosVisiveis({ lojaLigada: env.NUVEMSHOP_ENABLED }).map((p) => ({
    segmento: p.segmento,
    rotulo: p.rotulo,
    cumprido: p.cumprido(state),
  }));

  const isDev = process.env.NODE_ENV !== "production";
  const marca = branding();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <ForcarTemaEscuro />
      <header className="border-b border-white/10 bg-zinc-900/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <div className="min-w-0 space-y-1">
            <MarcaNoCabecalho logoUrl={marca.logoUrl} nome={marca.name} />
            <h1 className="text-lg font-semibold tracking-tight text-white">{activeOrg.name}</h1>
          </div>
          {isDev ? <SkipToEnd /> : null}
        </div>
        <div className="mx-auto w-full max-w-3xl px-4 pb-2">
          <Stepper passos={passos} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
