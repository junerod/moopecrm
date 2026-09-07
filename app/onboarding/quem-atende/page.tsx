import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { QuemAtendeForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function QuemAtendePage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Quem atende os novos contatos?
        </h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          Você decide se os novos atendimentos ficam na fila para alguém pegar,
          ou se o sistema distribui automaticamente entre o time.
        </p>
      </header>
      <QuemAtendeForm />
    </div>
  );
}
