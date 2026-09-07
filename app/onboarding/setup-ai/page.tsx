import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { SetupAiForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function SetupAiPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Como você quer usar Inteligência Artificial?
        </h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          O CRM funciona sem IA. Se quiser ajuda, comece pelo assistente — ele
          sugere, e a sua equipe envia. Nada daqui libera envio automático.
        </p>
      </header>
      <SetupAiForm />
    </div>
  );
}
